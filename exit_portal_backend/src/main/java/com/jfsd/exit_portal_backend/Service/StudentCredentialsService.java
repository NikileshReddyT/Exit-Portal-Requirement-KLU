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

import com.jfsd.exit_portal_backend.Model.StudentCredentials;
import com.jfsd.exit_portal_backend.Repository.StudentCredentialsRepository;
import com.jfsd.exit_portal_backend.Repository.StudentGradeRepository;

@Service
public class StudentCredentialsService {

    @Autowired
    private StudentGradeRepository studentGradeRepository;

    @Autowired
    private StudentCredentialsRepository studentCredentialsRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    // Method to generate and save unique student credentials
    public List<StudentCredentials> generateAndSaveUniqueStudentCredentials() {
        // Retrieve all unique student IDs from the StudentGrade repository
        List<String> studentIds = studentGradeRepository.findAllUniqueStudentIds();
        
        // Use a Set to handle unique student IDs
        Set<String> uniqueStudentIds = new HashSet<>(studentIds);
        
        List<StudentCredentials> credentials = new ArrayList<>();
        Random random = new Random();

        for (String studentId : uniqueStudentIds) {
            // Generate a 6-digit random password
            String password = String.format("%06d", random.nextInt(999999));
            String hashedPassword = passwordEncoder.encode(password);
            StudentCredentials credential = new StudentCredentials(studentId, hashedPassword);
            credentials.add(credential);
        }

        // Save all credentials to the StudentCredentials table
        return studentCredentialsRepository.saveAll(credentials);
    }

    // Method to find student credentials by studentId
    public Optional<StudentCredentials> findByStudentId(String studentId) {
        return studentCredentialsRepository.findByStudentId(studentId);
    }

    public List<StudentCredentials> getStudentCredentials() {
        return studentCredentialsRepository.findAll();
    }

    public ResponseEntity<String> populateCredentialsFromCSV(MultipartFile file) {
        if (file.isEmpty()) {
            return ResponseEntity.badRequest().body("Please select a CSV file to upload.");
        }

        try (BufferedReader reader = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            String line = reader.readLine(); // Assuming header line

            List<StudentCredentials> credentialsToSave = new ArrayList<>();
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

                Optional<StudentCredentials> existingCredentialOpt = studentCredentialsRepository.findByStudentId(studentId);

                if (existingCredentialOpt.isPresent()) {
                    // Update existing credential
                    StudentCredentials existingCredential = existingCredentialOpt.get();
                    existingCredential.setPassword(hashedPassword);
                    credentialsToSave.add(existingCredential);
                    updatedCount++;
                } else {
                    // Create new credential
                    StudentCredentials newCredential = new StudentCredentials(studentId, hashedPassword);
                    credentialsToSave.add(newCredential);
                    createdCount++;
                }
            }

            studentCredentialsRepository.saveAll(credentialsToSave);

            String message = String.format("CSV processed successfully: %d records created, %d records updated.", createdCount, updatedCount);
            return ResponseEntity.ok(message);

        } catch (IOException e) {
            e.printStackTrace();
            return ResponseEntity.internalServerError().body("Failed to process the CSV file: " + e.getMessage());
        }
    }
}
