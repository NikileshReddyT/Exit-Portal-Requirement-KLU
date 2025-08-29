package com.jfsd.exit_portal_backend.Service;

import java.io.BufferedReader;
import java.io.IOException;
import java.io.InputStreamReader;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Random;
import java.util.Set;
import java.util.Optional;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;

import com.jfsd.exit_portal_backend.Model.Student;
import com.jfsd.exit_portal_backend.Repository.StudentRepository;
import com.jfsd.exit_portal_backend.Repository.StudentGradeRepository;

@Service
public class StudentCredentialsService {

    @Autowired
    private StudentGradeRepository studentGradeRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // Method to generate and save unique student credentials (migrated to Student entity)
    public List<Student> generateAndSaveUniqueStudentCredentials() {
        // Retrieve all unique student IDs from the StudentGrade repository
        List<String> studentIds = studentGradeRepository.findAllUniqueStudentIds();
        
        // Use a Set to handle unique student IDs
        Set<String> uniqueStudentIds = new HashSet<>(studentIds);
        
        List<Student> toSave = new ArrayList<>();
        Random random = new Random();

        for (String studentId : uniqueStudentIds) {
            // Generate a 6-digit random password
            String password = String.format("%06d", random.nextInt(999999));
            String hashedPassword = passwordEncoder.encode(password);
            Optional<Student> existing = studentRepository.findByStudentId(studentId);
            if (existing.isPresent()) {
                Student s = existing.get();
                s.setPassword(hashedPassword);
                toSave.add(s);
            } else {
                Student s = new Student();
                s.setStudentId(studentId);
                s.setStudentName(null);
                s.setPassword(hashedPassword);
                toSave.add(s);
            }
        }

        // Save all students with generated credentials
        return studentRepository.saveAll(toSave);
    }

    // Method to find student credentials by studentId
    public Optional<Student> findByStudentId(String studentId) {
        return studentRepository.findByStudentId(studentId);
    }

    public List<Student> getStudentCredentials() {
        return studentRepository.findAll();
    }

    public ResponseEntity<String> populateCredentialsFromCSV(MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Please select a CSV file to upload.");
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line = reader.readLine(); // Assuming header line

            List<Student> toSave = new ArrayList<>();
            int updatedCount = 0;
            int createdCount = 0;

            while ((line = reader.readLine()) != null) {
                String[] fields = line.split(",");

                if (fields.length != 2) {
                    continue; // Skip malformed lines
                }

                String studentId = fields[0].trim();
                String password = fields[1].trim();

                if (studentId.isEmpty() || password.isEmpty()) {
                    continue; // Skip empty entries
                }

                String hashedPassword = passwordEncoder.encode(password);

                Optional<Student> existingOpt = studentRepository.findByStudentId(studentId);

                if (existingOpt.isPresent()) {
                    // Update existing credential
                    Student existing = existingOpt.get();
                    existing.setPassword(hashedPassword);
                    toSave.add(existing);
                    updatedCount++;
                } else {
                    // Create new credential
                    Student s = new Student();
                    s.setStudentId(studentId);
                    s.setStudentName(null);
                    s.setPassword(hashedPassword);
                    toSave.add(s);
                    createdCount++;
                }
            }

            studentRepository.saveAll(toSave);

            String message = String.format("CSV processed successfully: %d records created, %d records updated.", createdCount, updatedCount);
            return ResponseEntity.ok(message);

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Failed to process the CSV file: " + e.getMessage());
        }
    }
}
