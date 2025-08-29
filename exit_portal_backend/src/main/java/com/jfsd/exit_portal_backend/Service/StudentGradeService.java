package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.Repository.StudentGradeRepository;
import com.jfsd.exit_portal_backend.Repository.CoursesRepository;
import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Model.Student;
import com.jfsd.exit_portal_backend.Repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;

import org.springframework.stereotype.Service;
import org.springframework.web.multipart.MultipartFile;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionDefinition;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.security.crypto.password.PasswordEncoder;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.io.IOException;
import java.util.ArrayList;
import java.util.List;

import java.util.concurrent.atomic.AtomicInteger;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.Optional;
import java.util.Map;
import java.util.HashMap;

@Service
public class StudentGradeService {

    @Autowired
    private StudentGradeRepository studentGradeRepository;

    @Autowired
    private StudentCategoryProgressService studentCategoryProgressService;

    @Autowired
    private CoursesRepository coursesRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @PersistenceContext
    private EntityManager entityManager;

    @Autowired
    private PlatformTransactionManager transactionManager;

    private static final int BATCH_SIZE = 1000;

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

            // Upsert Students: preload existing and create missing with BCrypt(studentId)
            Map<String, Student> existingStudents = studentRepository.findAllByStudentIdIn(universityIdsInCsv)
                .stream().collect(Collectors.toMap(Student::getStudentId, s -> s));
            // capture a preferred name per student from CSV (column 2 if present)
            Map<String, String> nameById = new HashMap<>();
            for (int i = 1; i < lines.size(); i++) {
                String[] vals = parseCsvLine(lines.get(i));
                if (vals.length > 1) {
                    String id = vals[0] == null ? "" : vals[0].trim();
                    String nm = vals[1] == null ? "" : vals[1].trim();
                    if (!id.isEmpty() && !nm.isEmpty()) nameById.put(id, nm);
                }
            }
            List<Student> toCreateStudents = new ArrayList<>();
            for (String id : universityIdsInCsv) {
                if (!existingStudents.containsKey(id)) {
                    String nm = nameById.getOrDefault(id, "");
                    Student s = new Student(id, nm, passwordEncoder.encode(id));
                    toCreateStudents.add(s);
                    existingStudents.put(id, s);
                }
            }
            if (!toCreateStudents.isEmpty()) {
                studentRepository.saveAll(toCreateStudents);
            }

            // Preload existing grades for these students once
            List<StudentGrade> existingGrades = studentGradeRepository.findByStudent_StudentIdIn(universityIdsInCsv);
            // Key existing grades by (studentId, courseCode)
            java.util.Map<String, StudentGrade> existingGradesMap = existingGrades.stream()
                .filter(g -> g.getCourse() != null && g.getCourse().getCourseCode() != null && g.getStudent() != null)
                .collect(Collectors.toMap(g -> g.getStudent().getStudentId() + "-" + norm(g.getCourse().getCourseCode()), g -> g, (a,b) -> a));

            // Preload all unique course codes referenced in the CSV in one query
            List<String> csvCourseCodes = lines.stream().skip(1)
                .map(this::parseCsvLine)
                .filter(arr -> arr.length > 3 && arr[3] != null && !arr[3].trim().isEmpty())
                .map(arr -> arr[3].trim())
                .distinct()
                .collect(Collectors.toList());
            java.util.Map<String, Courses> courseByCode = coursesRepository.findByCourseCodeIn(csvCourseCodes)
                .stream()
                .filter(c -> c.getCourseCode() != null)
                .collect(Collectors.toMap(c -> norm(c.getCourseCode()), c -> c, (a, b) -> a));

            List<StudentGrade> gradesToSave = new ArrayList<>();
            java.util.concurrent.atomic.AtomicInteger totalSaved = new java.util.concurrent.atomic.AtomicInteger(0);
            // Transaction template for per-batch commits
            TransactionTemplate txTemplate = new TransactionTemplate(transactionManager);
            txTemplate.setPropagationBehavior(TransactionDefinition.PROPAGATION_REQUIRES_NEW);
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
                String lookupKey = universityId + "-" + norm(courseCode);

                StudentGrade grade = existingGradesMap.get(lookupKey);
                if (grade != null) {
                    updatedRecords.incrementAndGet();
                } else {
                    grade = new StudentGrade();
                    Student s = existingStudents.get(universityId);
                    if (s == null) {
                        s = new Student(universityId, nameById.getOrDefault(universityId, ""), passwordEncoder.encode(universityId));
                        s = studentRepository.save(s);
                        existingStudents.put(universityId, s);
                    }
                    grade.setStudent(s);
                    grade.setCourseCode(courseCode);
                    createdRecords.incrementAndGet();
                }
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

                // Resolve and set Course entity using preloaded map (no per-row DB call)
                if (courseCode != null && !courseCode.isEmpty()) {
                    Courses course = courseByCode.get(norm(courseCode));
                    if (course != null) {
                        grade.setCourse(course);
                        // Note: Category is now stored directly in StudentGrade CSV
                        // Course-to-category mapping is handled by ProgramCourseCategory
                    }
                }

                // Fallback: Ensure category is never null to satisfy DB NOT NULL until migration is applied
                if (grade.getCategory() == null) {
                    grade.setCategory("");
                }

                gradesToSave.add(grade);

                // Flush in batches and print progress
                if (gradesToSave.size() >= BATCH_SIZE) {
                    txTemplate.execute(status -> {
                        studentGradeRepository.saveAll(gradesToSave);
                        studentGradeRepository.flush();
                        entityManager.clear();
                        totalSaved.addAndGet(gradesToSave.size());
                        System.out.println("Saved batch. Total saved so far: " + totalSaved.get());
                        gradesToSave.clear();
                        return null;
                    });
                }
            }

            if (!gradesToSave.isEmpty()) {
                txTemplate.execute(status -> {
                    studentGradeRepository.saveAll(gradesToSave);
                    studentGradeRepository.flush();
                    entityManager.clear();
                    totalSaved.addAndGet(gradesToSave.size());
                    System.out.println("Saved final batch. Total saved: " + totalSaved.get());
                    return null;
                });
            }

            // Recalculate progress AFTER COMMIT to prevent rolling back saved batches if it fails
            if (totalSaved.get() > 0) {
                if (TransactionSynchronizationManager.isSynchronizationActive()) {
                    TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
                        @Override
                        public void afterCommit() {
                            try {
                                studentCategoryProgressService.calculateAndUpdateProgressForStudents(universityIdsInCsv);
                            } catch (Exception ex) {
                                System.err.println("Progress calculation failed post-commit: " + ex.getMessage());
                            }
                        }
                    });
                } else {
                    try {
                        studentCategoryProgressService.calculateAndUpdateProgressForStudents(universityIdsInCsv);
                    } catch (Exception ex) {
                        System.err.println("Progress calculation failed: " + ex.getMessage());
                    }
                }
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
        return studentGradeRepository.findByStudent_StudentId(universityId);
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
            existingGrade.setStudent(gradeDetails.getStudent());
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

    // Normalize course codes for consistent map keys and lookups
    private String norm(String s) {
        return s == null ? "" : s.trim().toUpperCase();
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