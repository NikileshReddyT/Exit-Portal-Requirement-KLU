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
import java.util.Objects;
import java.util.concurrent.ConcurrentLinkedQueue;
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

    // Upload CSV file
        // Upload CSV file
        @Transactional
        public List<String> uploadCSV(MultipartFile file) {
            ConcurrentLinkedQueue<String> messages = new ConcurrentLinkedQueue<>();
            AtomicInteger updatedRecords = new AtomicInteger(0);
            AtomicInteger createdRecords = new AtomicInteger(0);
            AtomicInteger rowNumberCounter = new AtomicInteger(1);

            try (BufferedReader br = new BufferedReader(new InputStreamReader(file.getInputStream()))) {
                List<String> lines = br.lines().collect(Collectors.toList());

                List<StudentGrade> gradesToSave = lines.parallelStream()
                    .skip(1) // Skip header row
                    .map(line -> {
                        int rowNumber = rowNumberCounter.incrementAndGet();
                        String[] values = parseCsvLine(line);

                        if (values.length < 5) {
                            messages.add("Skipping row " + rowNumber + ": Not enough columns.");
                            return null;
                        }

                        String universityId = values[0].trim();
                        String courseCode = values[3].trim();

                        Optional<StudentGrade> existingGradeOpt = studentGradeRepository.findByUniversityIdAndCourseCode(universityId, courseCode);

                        StudentGrade grade;
                        if (existingGradeOpt.isPresent()) {
                            grade = existingGradeOpt.get();
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
                            if (values.length > 6) grade.setGradePoint(Double.parseDouble(values[6].trim()));
                            if (values.length > 7) grade.setCredits(Double.parseDouble(values[7].trim()));
                        } catch (NumberFormatException e) {
                            messages.add("Skipping row " + rowNumber + ": Invalid number format for grade point or credits.");
                            return null;
                        }

                        if (values.length > 8) grade.setPromotion(values[8].trim());
                        if (values.length > 9) grade.setYear(values[9].trim());
                        if (values.length > 10) grade.setSemester(values[10].trim());
                        if (values.length > 11) grade.setCategory(values[11].trim());

                        return grade;
                    })
                    .filter(Objects::nonNull)
                    .collect(Collectors.toList());

                if (!gradesToSave.isEmpty()) {
                    studentGradeRepository.saveAll(gradesToSave);
                    messages.add("Successfully created " + createdRecords.get() + " and updated " + updatedRecords.get() + " grade records.");

                    // Trigger progress recalculation for affected students
                    Set<String> affectedStudentIds = gradesToSave.stream()
                                                         .map(StudentGrade::getUniversityId)
                                                         .collect(Collectors.toSet());
                    studentCategoryProgressService.calculateAndUpdateProgressForStudents(affectedStudentIds);
                    messages.add("Successfully triggered progress recalculation for " + affectedStudentIds.size() + " students.");

                } else {
                    messages.add("No valid grade records found to import.");
                }

            } catch (IOException e) {
                messages.add("Error reading CSV file: " + e.getMessage());
            }

            return new ArrayList<>(messages);
        }  
    // Get all grades
    public List<StudentGrade> getAllGrades() {
        return studentGradeRepository.findAll();
    }

    // Get grades by university ID
    public List<StudentGrade> getGradesByUniversityId(String universityId) {
        return studentGradeRepository.findByUniversityId(universityId);
    }

    // Get grade by ID
    public Optional<StudentGrade> getGradeById(Long id) {
        return studentGradeRepository.findById(id);
    }

    // Save a single grade
    public StudentGrade saveGrade(StudentGrade grade) {
        return studentGradeRepository.save(grade);
    }

    // Delete a grade
    public void deleteGrade(Long id) {
        studentGradeRepository.deleteById(id);
    }

    // Update a grade
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
        if (currentValue.length() > 0) {
            values.add(currentValue.toString().trim());
        }

        return values.toArray(new String[0]);
    }





}