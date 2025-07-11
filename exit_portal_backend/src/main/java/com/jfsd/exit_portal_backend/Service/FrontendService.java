package com.jfsd.exit_portal_backend.Service;

import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.jfsd.exit_portal_backend.RequestBodies.CategoryCoursesDTO;
import com.jfsd.exit_portal_backend.RequestBodies.InvalidPasswordException;
import com.jfsd.exit_portal_backend.RequestBodies.StudentCategoryProgressDTO;
import com.jfsd.exit_portal_backend.RequestBodies.StudentCourseReportDTO;
import com.jfsd.exit_portal_backend.RequestBodies.UserNotFoundException;
import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.Model.StudentCredentials;
import com.jfsd.exit_portal_backend.Repository.StudentCategoryProgressRepository;
import com.jfsd.exit_portal_backend.Repository.StudentCredentialsRepository;
import com.jfsd.exit_portal_backend.Repository.StudentGradeRepository;
import com.jfsd.exit_portal_backend.Repository.CoursesRepository;

import com.jfsd.exit_portal_backend.RequestBodies.Student;

@Service
public class FrontendService {

    private static final Logger logger = LoggerFactory.getLogger(FrontendService.class);

    @Autowired
    private StudentCategoryProgressRepository studentCategoryProgressRepository;

    @Autowired
    private StudentCredentialsRepository studentCredentialsRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private StudentGradeRepository studentGradeRepository;



    @Autowired
    private CoursesRepository coursesRepository;

    public List<StudentCategoryProgress> getStudentCategoryProgress(String universityId) {
        return studentCategoryProgressRepository.findByUniversityId(universityId);
    }

    // Updated method to check both universityId and password
    public Student authenticateStudent(String universityId, String password) {
        logger.info("Authenticating student with ID: {}", universityId);
        StudentCredentials studentCredentials = studentCredentialsRepository.findByStudentId(universityId)
                .orElseThrow(() -> {
                    logger.warn("Authentication failed: User not found with ID: {}", universityId);
                    return new UserNotFoundException("User not found.");
                });

        logger.info("User found. Checking password.");
        if (!passwordEncoder.matches(password, studentCredentials.getPassword())) {
            logger.warn("Authentication failed: Incorrect password for user ID: {}", universityId);
            throw new InvalidPasswordException("Incorrect password.");
        }

        logger.info("Password verified. Authentication successful for user ID: {}", universityId);
        Student studentData = new Student();
        studentData.setUniversityId(studentCredentials.getStudentId());
        return studentData;
    }

    public List<StudentGrade> getCoursesByCategory(String universityId, String category) {
        return studentGradeRepository.findByUniversityIdAndCategory(universityId, category);
    }

    public List<Courses> getAllCoursesByCategory(String categoryName) {
        return coursesRepository.findAllByCategory(categoryName);
    }

    public StudentCourseReportDTO generateStudentReport(String universityId) {
        // Step 1: Use the highly optimized query to get all progress aggregates in one shot.
        List<StudentCategoryProgressDTO> progressSummary = studentCategoryProgressRepository.findStudentProgressSummary(universityId);
        if (progressSummary == null || progressSummary.isEmpty()) {
            return null; // No progress data found for the student.
        }

        // Step 2: Fetch all student grades in a second, efficient query.
        List<StudentGrade> allStudentGrades = studentGradeRepository.findByUniversityId(universityId);
        Map<String, List<StudentGrade>> gradesByCategory = allStudentGrades.stream()
                .collect(Collectors.groupingBy(StudentGrade::getCategory));

        // Step 3: Get student's name from the first available record.
        StudentCategoryProgress studentInfo = studentCategoryProgressRepository.findFirstByUniversityId(universityId);
        String studentName = (studentInfo != null) ? studentInfo.getStudentName() : "Student";

        StudentCourseReportDTO reportDTO = new StudentCourseReportDTO();
        reportDTO.setStudentId(universityId);
        reportDTO.setStudentName(studentName);

        List<CategoryCoursesDTO> categoryDTOs = new ArrayList<>();
        int totalRegisteredCourses = 0;
        double totalRegisteredCredits = 0.0;

        // Step 4: Combine the aggregated data with the detailed course lists.
        for (StudentCategoryProgressDTO progress : progressSummary) {
            CategoryCoursesDTO categoryDTO = new CategoryCoursesDTO();
            categoryDTO.setCategoryName(progress.getCategoryName());
            categoryDTO.setMinRequiredCourses(progress.getMinRequiredCourses());
            categoryDTO.setMinRequiredCredits(progress.getMinRequiredCredits());
            categoryDTO.setRegisteredCourses((int) progress.getRegisteredCourses());
            categoryDTO.setRegisteredCredits(progress.getRegisteredCredits());
            categoryDTO.setCompletedCourses((int) progress.getCompletedCourses());
            categoryDTO.setCompletedCredits(progress.getCompletedCredits());

            // Add the detailed course list from the map.
            categoryDTO.setCourses(gradesByCategory.getOrDefault(progress.getCategoryName(), new ArrayList<>()));

            categoryDTOs.add(categoryDTO);

            totalRegisteredCourses += progress.getRegisteredCourses();
            totalRegisteredCredits += progress.getRegisteredCredits();
        }

        reportDTO.setCategories(categoryDTOs);
        reportDTO.setTotalRegisteredCourses(totalRegisteredCourses);
        reportDTO.setTotalRegisteredCredits(totalRegisteredCredits);

        return reportDTO;
    }
}
