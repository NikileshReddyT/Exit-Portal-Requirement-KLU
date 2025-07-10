package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.Repository.StudentGradeRepository;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.multipart.MultipartFile;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.Optional;

@Service
public class StudentGradeService {

    @Autowired
    private StudentGradeRepository studentGradeRepository;

    @Autowired
    private StudentCategoryProgressService studentCategoryProgressService;

    @Transactional
    public List<String> uploadCSV(MultipartFile file) {
        List<String> messages = new ArrayList<>();
        AtomicInteger updatedRecords = new AtomicInteger(0);
        AtomicInteger createdRecords = new AtomicInteger(0);

        try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
            List<String> lines = br.lines().collect(Collectors.toList());
            if (lines.size() <= 1) {
                messages.add("CSV file is empty or contains only a header.");
                return messages;
            }

            Set<String> universityIdsInCsv = lines.stream().skip(1)
                .map(line -> {
                    String[] values = parseCsvLine(line);
                    return (values.length > 0) ? values[0].trim() : "";
                })
                .filter(id -> !id.isEmpty())
                .collect(Collectors.toSet());

            if (universityIdsInCsv.isEmpty()) {
                messages.add("No valid student IDs found in the CSV file.");
                return messages;
            }

            List<StudentGrade> existingGrades = studentGradeRepository.findByUniversityIdIn(universityIdsInCsv);
            
            java.util.Map<String, StudentGrade> existingGradesMap = existingGrades.stream()
                .collect(Collectors.toMap(grade -> grade.getUniversityId() + "-" + grade.getCourseCode(), grade -> grade));

            List<StudentGrade> gradesToSave = new ArrayList<>();
            for (int i = 1; i < lines.size(); i++) {
                String line = lines.get(i);
                int rowNumber = i + 1;
                String[] values = parseCsvLine(line);

                if (values.length < 5 || values[0].trim().isEmpty()) {
                    messages.add("Skipping row " + rowNumber + ": Not enough columns or missing University ID.");
                    continue;
                }

                String universityId = values[0].trim();
                String courseCode = values[3].trim();
                String lookupKey = universityId + "-" + courseCode;

                StudentGrade grade = existingGradesMap.get(lookupKey);
                if (grade != null) {
                    updatedRecords.incrementAndGet();
                } else {
                    grade = new StudentGrade();
                    grade.setUniversityId(universityId);
                    grade.setCourseCode(courseCode);
                    createdRecords.incrementAndGet();
                }

                grade.setStudentName(values[1].trim());
                grade.setStatus(values[2].trim());
                grade.setCourseName(values[4].trim());

                if (values.length > 5) {
                    String gradeValue = values[5].trim().replace("\"", "");
                    int indexOfParenthesis = gradeValue.indexOf('(');
                    if (indexOfParenthesis != -1) {
                        gradeValue = gradeValue.substring(0, indexOfParenthesis).trim();
                    }
                    grade.setGrade(gradeValue);
                }

                try {
                    if (values.length > 6 && !values[6].trim().isEmpty()) grade.setGradePoint(Double.parseDouble(values[6].trim()));
                    if (values.length > 7 && !values[7].trim().isEmpty()) grade.setCredits(Double.parseDouble(values[7].trim()));
                } catch (NumberFormatException e) {
                    messages.add("Skipping row " + rowNumber + ": Invalid number format for grade point or credits.");
                    continue;
                }

                if (values.length > 8) grade.setPromotion(values[8].trim());
                if (values.length > 9) grade.setYear(values[9].trim());
                if (values.length > 10) grade.setSemester(values[10].trim());
                if (values.length > 11) grade.setCategory(values[11].trim());

                gradesToSave.add(grade);
            }

            if (!gradesToSave.isEmpty()) {
                studentGradeRepository.saveAll(gradesToSave);
                studentCategoryProgressService.calculateAndUpdateProgressForStudents(universityIdsInCsv);
            }

            messages.add("CSV file processed successfully.");
            messages.add("Created records: " + createdRecords.get());
            messages.add("Updated records: " + updatedRecords.get());

        } catch (IOException e) {
            messages.add("Error reading file: " + e.getMessage());
        }

        return messages;
    }

    public List<StudentGrade> getAllGrades() {
        return studentGradeRepository.findAll();
    }

    public List<StudentGrade> getGradesByUniversityId(String universityId) {
        return studentGradeRepository.findByUniversityId(universityId);
    }

    public Optional<StudentGrade> getGradeById(Long id) {
        return studentGradeRepository.findById(id);
    }

    public StudentGrade saveGrade(StudentGrade grade) {
        return studentGradeRepository.save(grade);
    }

    public void deleteGrade(Long id) {
        studentGradeRepository.deleteById(id);
    }

    public StudentGrade updateGrade(Long id, StudentGrade gradeDetails) {
        Optional<StudentGrade> grade = studentGradeRepository.findById(id);
        if (grade.isPresent()) {
            StudentGrade existingGrade = grade.get();
            existingGrade.setUniversityId(gradeDetails.getUniversityId());
            existingGrade.setStudentName(gradeDetails.getStudentName());
            existingGrade.setCourseCode(gradeDetails.getCourseCode());
            existingGrade.setCourseName(gradeDetails.getCourseName());
            existingGrade.setGrade(gradeDetails.getGrade());
            existingGrade.setGradePoint(gradeDetails.getGradePoint());
            existingGrade.setCredits(gradeDetails.getCredits());
            existingGrade.setPromotion(gradeDetails.getPromotion());
            existingGrade.setCategory(gradeDetails.getCategory());
            return studentGradeRepository.save(existingGrade);
        }
        return null;
    }

    private String[] parseCsvLine(String line) {
        List<String> values = new ArrayList<>();
        StringBuilder currentValue = new StringBuilder();
        boolean inQuotes = false;

        for (char c : line.toCharArray()) {
            if (c == '"') {
                inQuotes = !inQuotes;
            } else if (c == ',' && !inQuotes) {
                values.add(currentValue.toString().trim());
                currentValue.setLength(0);
            } else {
                currentValue.append(c);
            }
        }
        values.add(currentValue.toString().trim());

        return values.toArray(new String[0]);
    }
}