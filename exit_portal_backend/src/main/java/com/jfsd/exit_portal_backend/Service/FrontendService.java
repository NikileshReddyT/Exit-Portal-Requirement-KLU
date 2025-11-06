package com.jfsd.exit_portal_backend.Service;

import java.util.ArrayList;
import java.util.Collections;
import java.util.List;
// import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.Map;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.cache.annotation.Cacheable;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.jfsd.exit_portal_backend.dto.CategoryCoursesDTO;
import com.jfsd.exit_portal_backend.dto.InvalidPasswordException;
import com.jfsd.exit_portal_backend.dto.StudentCategoryProgressDTO;
import com.jfsd.exit_portal_backend.dto.StudentCourseReportDTO;
import com.jfsd.exit_portal_backend.dto.UserNotFoundException;
import com.jfsd.exit_portal_backend.dto.incompleteCategoryCourses;
import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.Model.ProgramCourseCategory;
// import com.jfsd.exit_portal_backend.Repository.StudentCategoryProgressRepository;
import com.jfsd.exit_portal_backend.Repository.StudentGradeRepository;
// import com.jfsd.exit_portal_backend.Repository.CoursesRepository;
import com.jfsd.exit_portal_backend.Repository.StudentRepository;
import com.jfsd.exit_portal_backend.Repository.ProgramCourseCategoryRepository;

import com.jfsd.exit_portal_backend.dto.Student;
import com.jfsd.exit_portal_backend.dto.honors.StudentHonorsStatusDTO;
import com.jfsd.exit_portal_backend.dto.honors.HonorsRequirementStatusDTO;
// import com.jfsd.exit_portal_backend.Service.StudentCategoryProgressService;

@Service
public class FrontendService {

    private static final Logger logger = LoggerFactory.getLogger(FrontendService.class);

    // @Autowired
    // private StudentCategoryProgressRepository studentCategoryProgressRepository;

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private StudentGradeRepository studentGradeRepository;



    // @Autowired
    // private CoursesRepository coursesRepository;

    @Autowired
    private StudentCategoryProgressService studentCategoryProgressService;

    @Autowired
    private ProgramCourseCategoryRepository programCourseCategoryRepository;

    @Cacheable(cacheNames = "student_api", key = "'getStudentCategoryProgress:' + #universityId")
    public List<StudentCategoryProgressDTO> getStudentCategoryProgress(String universityId) {
        long _startNanos = System.nanoTime();
        // Fetch persisted/enriched progress rows (3NF-aware, program-scoped)
        List<StudentCategoryProgress> rows = studentCategoryProgressService.getStudentProgress(universityId);
        StudentHonorsStatusDTO honorsStatus = studentCategoryProgressService.buildStudentHonorsStatus(universityId, rows);
        Map<String, HonorsRequirementStatusDTO> honorsByCategory = Collections.emptyMap();
        if (honorsStatus != null && honorsStatus.getCategoryStatuses() != null) {
            honorsByCategory = honorsStatus.getCategoryStatuses().stream()
                    .filter(status -> status.getCategoryName() != null)
                    .collect(Collectors.toMap(
                            status -> status.getCategoryName().trim().toLowerCase(),
                            Function.identity(),
                            (a, b) -> a
                    ));
        }
        if (rows == null || rows.isEmpty()) {
            logger.info("getStudentCategoryProgress for student {} completed in {} ms (no rows)", universityId, (System.nanoTime() - _startNanos) / 1_000_000);
            return new ArrayList<>();
        }

        // Preload all grades once and group by normalized category to avoid N+1 queries
        List<StudentGrade> allGrades = studentGradeRepository.findWithCourseByStudentId(universityId);
        Map<String, List<StudentGrade>> gradesByCategory = allGrades.stream()
                .filter(g -> g.getCategory() != null)
                .collect(Collectors.groupingBy(g -> g.getCategory().trim().toLowerCase()));

        List<StudentCategoryProgressDTO> result = new ArrayList<>();
        try {
            for (StudentCategoryProgress scp : rows) {
                String categoryName = scp.getCategoryName();
                String normCat = categoryName != null ? categoryName.trim().toLowerCase() : "";

                // Registered metrics from preloaded grades (historical: all attempts)
                List<StudentGrade> registeredGrades = gradesByCategory.getOrDefault(normCat, java.util.Collections.emptyList());
                long registeredCourses = registeredGrades.size();
                double registeredCredits = registeredGrades.stream()
                        .map(StudentGrade::getCredits)
                        .filter(Objects::nonNull)
                        .mapToDouble(Double::doubleValue)
                        .sum();

                // New: strictly current pending registrations (promotion == 'R')
                long pendingRegisteredCourses = registeredGrades.stream()
                        .filter(g -> g.getPromotion() != null && "R".equalsIgnoreCase(g.getPromotion()))
                        .count();
                double pendingRegisteredCredits = registeredGrades.stream()
                        .filter(g -> g.getPromotion() != null && "R".equalsIgnoreCase(g.getPromotion()))
                        .map(StudentGrade::getCredits)
                        .filter(Objects::nonNull)
                        .mapToDouble(Double::doubleValue)
                        .sum();

                int minCourses = (scp.getMinRequiredCourses() != null) ? scp.getMinRequiredCourses() : 0;
                double minCredits = (scp.getMinRequiredCredits() != null) ? scp.getMinRequiredCredits() : 0.0;
                HonorsRequirementStatusDTO honorsMatch = honorsByCategory.get(normCat);
                Double honorsMinCredits = honorsMatch != null ? honorsMatch.getHonorsMinCredits() : null;
                boolean honorsRequirementMet = honorsMatch != null && honorsMatch.isMet();
                long completedCourses = (scp.getCompletedCourses() != null) ? scp.getCompletedCourses().longValue() : 0L;
                Double completedCredits = scp.getCompletedCredits();

                StudentCategoryProgressDTO dto = new StudentCategoryProgressDTO(
                        categoryName,
                        minCourses,
                        minCredits,
                        honorsMinCredits,
                        honorsRequirementMet,
                        registeredCourses,
                        registeredCredits,
                        completedCourses,
                        completedCredits
                );
                // Backward compatible enrichment with pending registration metrics
                dto.setPendingRegisteredCourses(pendingRegisteredCourses);
                dto.setPendingRegisteredCredits(pendingRegisteredCredits);
                result.add(dto);
            }
            return result;
        } finally {
            long _elapsedMs = (System.nanoTime() - _startNanos) / 1_000_000;
            logger.info("getStudentCategoryProgress for student {} completed in {} ms (rows={}, grades={})", universityId, _elapsedMs, rows.size(), allGrades.size());
        }
    }

    // Updated method to check both universityId and password
    public Student authenticateStudent(String universityId, String password) {
        logger.info("Authenticating student with ID: {}", universityId);
        com.jfsd.exit_portal_backend.Model.Student studentEntity = studentRepository.findByStudentId(universityId)
                .orElseThrow(() -> {
                    logger.warn("Authentication failed: User not found with ID: {}", universityId);
                    return new UserNotFoundException("User not found.");
                });

        logger.info("User found. Checking password.");
        if (!passwordEncoder.matches(password, studentEntity.getPassword())) {
            logger.warn("Authentication failed: Incorrect password for user ID: {}", universityId);
            throw new InvalidPasswordException("Incorrect password.");
        }

        logger.info("Password verified. Authentication successful for user ID: {}", universityId);
        Student studentData = new Student();
        studentData.setUniversityId(studentEntity.getStudentId());
        studentData.setStudentName(studentEntity.getStudentName());
        System.out.println("Student Data: "+studentData.getStudentName());
        
        return studentData;
    }

    @Cacheable(cacheNames = "student_api", key = "'getCoursesByCategory:' + #universityId + ':' + #category")
    public List<StudentGrade> getCoursesByCategory(String universityId, String category) {
        return studentGradeRepository.findByStudentIdAndCategory(universityId, category);
    }

    @Cacheable(cacheNames = "student_api", key = "'getAllCoursesByCategory:' + #categoryName")
    public List<Courses> getAllCoursesByCategory(String categoryName) {
        List<ProgramCourseCategory> mappings = programCourseCategoryRepository.findByCategoryName(categoryName);
        if (mappings == null || mappings.isEmpty()) {
            return new ArrayList<>();
        }
        return mappings.stream()
                .map(ProgramCourseCategory::getCourse)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());
    }

    @Cacheable(cacheNames = "student_api", key = "'generateStudentReport:' + #universityId")
    public StudentCourseReportDTO generateStudentReport(String universityId) {
        long _startNanos = System.nanoTime();
        try {
            // Fetch student
            com.jfsd.exit_portal_backend.Model.Student studentEntity = studentRepository.findByStudentId(universityId)
                    .orElseThrow(() -> new UserNotFoundException("User not found."));

            // Fetch category progress rows (includes min requirements and completed metrics)
            List<StudentCategoryProgress> rows = studentCategoryProgressService.getStudentProgress(universityId);
            List<StudentCategoryProgressDTO> studentCategoryProgressDTO = getStudentCategoryProgress(universityId);
            StudentHonorsStatusDTO honorsStatus = studentCategoryProgressService.buildStudentHonorsStatus(universityId, rows);
            Map<String, HonorsRequirementStatusDTO> honorsByCategory;
            if (honorsStatus != null && honorsStatus.getCategoryStatuses() != null) {
                honorsByCategory = honorsStatus.getCategoryStatuses().stream()
                        .filter(status -> status.getCategoryName() != null)
                        .collect(Collectors.toMap(
                                status -> status.getCategoryName().trim().toLowerCase(),
                                Function.identity(),
                                (a, b) -> a
                        ));
            } else {
                honorsByCategory = Collections.emptyMap();
            }

            StudentCourseReportDTO report = new StudentCourseReportDTO();
            report.setStudentId(studentEntity.getStudentId());
            report.setStudentName(studentEntity.getStudentName());
            report.setCategoryProgress(studentCategoryProgressDTO);
            if (honorsStatus != null) {
                report.setHonorsEligible(honorsStatus.isEligible());
                report.setHasAnyFailure(honorsStatus.isHasAnyFailure());
                List<HonorsRequirementStatusDTO> statusCopy = honorsStatus.getCategoryStatuses() != null
                        ? new ArrayList<>(honorsStatus.getCategoryStatuses())
                        : Collections.emptyList();
                report.setHonorsCategoryStatuses(statusCopy);
            } else {
                report.setHonorsEligible(false);
                report.setHasAnyFailure(false);
                report.setHonorsCategoryStatuses(Collections.emptyList());
            }

            List<CategoryCoursesDTO> categories = new ArrayList<>();
            int totalCompletedCourses = 0;
            double totalCompletedCredits = 0.0;

            // Fetch all grades once with JOIN FETCH on course and reuse
            List<StudentGrade> allGrades = studentGradeRepository.findWithCourseByStudentId(universityId);
            // Set of course IDs that are completed (promotion == 'P')
            Set<Integer> completedCourseIds = allGrades.stream()
                    .filter(g -> g.getCourse() != null && g.getPromotion() != null && "P".equalsIgnoreCase(g.getPromotion()))
                    .map(g -> g.getCourse().getCourseID())
                    .collect(Collectors.toSet());

            // Group grades by category (normalized)
            Map<String, List<StudentGrade>> gradesByCategory = allGrades.stream()
                    .filter(g -> g.getCategory() != null)
                    .collect(Collectors.groupingBy(g -> g.getCategory().trim().toLowerCase()));

            // Preload all program-category-course mappings once (JOIN FETCH) and group by category
            Map<String, List<Courses>> programCoursesByCategory;
            if (studentEntity.getProgram() != null && studentEntity.getProgram().getProgramId() != null) {
                List<ProgramCourseCategory> allMappings = programCourseCategoryRepository
                        .findByProgramIdWithCourseAndCategory(studentEntity.getProgram().getProgramId());
                programCoursesByCategory = allMappings.stream()
                        .filter(m -> m.getCategory() != null && m.getCategory().getCategoryName() != null)
                        .filter(m -> m.getCourse() != null)
                        .collect(Collectors.groupingBy(
                                m -> m.getCategory().getCategoryName().trim().toLowerCase(),
                                Collectors.collectingAndThen(
                                        Collectors.toMap(
                                                m -> m.getCourse().getCourseID(),
                                                ProgramCourseCategory::getCourse,
                                                (a,b) -> a
                                        ),
                                        map -> new ArrayList<>(map.values())
                                )
                        ));
            } else {
                // No program: leave map empty; we'll treat categories as having no predefined courses.
                programCoursesByCategory = java.util.Collections.emptyMap();
            }

            for (StudentCategoryProgress scp : rows) {
                String categoryName = scp.getCategoryName();
                // Get all attempts in this category for the student (for DTO.courses)
                String normCat = categoryName != null ? categoryName.trim().toLowerCase() : "";
                List<StudentGrade> grades = gradesByCategory.getOrDefault(normCat, java.util.Collections.emptyList());

                // Completed metrics are already present in scp
                int completedCourses = scp.getCompletedCourses() != null ? scp.getCompletedCourses() : 0;
                double completedCredits = scp.getCompletedCredits() != null ? scp.getCompletedCredits() : 0.0;

                totalCompletedCourses += completedCourses;
                totalCompletedCredits += completedCredits;

                CategoryCoursesDTO cat = new CategoryCoursesDTO();
                cat.setCategoryName(categoryName);
                cat.setMinRequiredCourses(scp.getMinRequiredCourses() != null ? scp.getMinRequiredCourses() : 0);
                cat.setMinRequiredCredits(scp.getMinRequiredCredits() != null ? scp.getMinRequiredCredits() : 0.0);
                cat.setCompletedCourses(completedCourses);
                cat.setCompletedCredits(completedCredits);
                cat.setCourses(grades != null ? grades : new ArrayList<>());
                HonorsRequirementStatusDTO honorsMatch = honorsByCategory.getOrDefault(normCat, null);
                if (honorsMatch != null) {
                    cat.setHonorsMinCredits(honorsMatch.getHonorsMinCredits());
                    cat.setHonorsRequirementMet(honorsMatch.isMet());
                } else {
                    cat.setHonorsMinCredits(null);
                    cat.setHonorsRequirementMet(false);
                }

                // Build incompleteCourses: program-scoped category courses minus completed ones (promotion=='P')
                List<incompleteCategoryCourses> incomplete = new ArrayList<>();
                List<Courses> categoryCourses = programCoursesByCategory.getOrDefault(normCat, java.util.Collections.emptyList());
                for (Courses c : categoryCourses) {
                    if (c != null && !completedCourseIds.contains(c.getCourseID())) {
                        incomplete.add(new incompleteCategoryCourses(
                                c.getCourseTitle(),
                                c.getCourseCode(),
                                c.getCourseCredits(),
                                categoryName
                        ));
                    }
                }
                cat.setIncompleteCourses(incomplete);
                categories.add(cat);
            }

            report.setCategories(categories);
            report.setTotalCompletedCourses(totalCompletedCourses);
            report.setTotalCompletedCredits(totalCompletedCredits);
            return report;
        } finally {
            long _elapsedMs = (System.nanoTime() - _startNanos) / 1_000_000;
            logger.info("generateStudentReport for student {} completed in {} ms", universityId, _elapsedMs);
        }
    }
}
