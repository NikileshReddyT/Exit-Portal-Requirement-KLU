package com.jfsd.exit_portal_backend.Service;

import java.util.ArrayList;
import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import com.jfsd.exit_portal_backend.RequestBodies.CategoryCoursesDTO;
import com.jfsd.exit_portal_backend.RequestBodies.InvalidPasswordException;
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

    @Autowired
    private StudentCategoryProgressRepository studentCategoryProgressRepository;

    @Autowired
    private StudentGradeRepository studentGradeRepository;

    @Autowired
    private CoursesRepository coursesRepository;

    @Autowired
    private StudentCredentialsRepository studentCredentialsRepository;

    public List<StudentCategoryProgress> getStudentCategoryProgress(String request) {
        return studentCategoryProgressRepository.findByUniversityId(request);
    }

    // Updated method to check both universityId and password
    public Student authenticateStudent(String studentId, String password) throws Exception {
        StudentCredentials studentCredentials = studentCredentialsRepository.findByStudentId(studentId)
                .orElseThrow(() -> new UserNotFoundException("User not found."));
    
        if (!studentCredentials.getPassword().equals(password)) {
            throw new InvalidPasswordException("Incorrect password.");
        }
    
        Student studentData = new Student();
        studentData.setUniversityid(studentCredentials.getStudentId());
        return studentData;
    }
    







    
    public List<StudentGrade> getCoursesByCategory(String universityId, String category) {
        return studentGradeRepository.findByUniversityIdAndCategory(universityId, category);
    }

    public List<Courses> getAllCoursesByCategory(String categoryName) {
        return coursesRepository.findAllByCategory(categoryName);
    }

    public StudentCourseReportDTO generateStudentReport(String universityId) {
        List<StudentCategoryProgress> categoryProgressList = studentCategoryProgressRepository.findByUniversityId(universityId);
        if (categoryProgressList == null || categoryProgressList.isEmpty()) {
            return null;
        }

        StudentCourseReportDTO reportDTO = new StudentCourseReportDTO();
        reportDTO.setStudentId(universityId);
        reportDTO.setStudentName(categoryProgressList.get(0).getStudentName());

        List<CategoryCoursesDTO> categoryDTOs = new ArrayList<>();
        int totalRegisteredCourses = 0;
        double totalRegisteredCredits = 0.0;

        for (StudentCategoryProgress progress : categoryProgressList) {
            CategoryCoursesDTO categoryDTO = new CategoryCoursesDTO();
            categoryDTO.setCategoryName(progress.getCategoryName());
            categoryDTO.setMinRequiredCourses(progress.getMinRequiredCourses());
            categoryDTO.setMinRequiredCredits(progress.getMinRequiredCredits());

            List<StudentGrade> studentGrades = getCoursesByCategory(universityId, progress.getCategoryName());
            categoryDTO.setCourses(studentGrades);

            int completedCoursesCount = 0;
            double completedCreditsSum = 0.0;
            for (StudentGrade grade : studentGrades) {
                // Assuming 'F' grade means not passed. Adjust if other grades also mean failure.
                if (grade.getGrade() != null && !grade.getGrade().equalsIgnoreCase("F")) {
                    completedCoursesCount++;
                    completedCreditsSum += grade.getCredits();
                }
            }

            categoryDTO.setRegisteredCourses(studentGrades.size());
            categoryDTO.setRegisteredCredits(studentGrades.stream().mapToDouble(StudentGrade::getCredits).sum());
            categoryDTO.setCompletedCourses(completedCoursesCount);
            categoryDTO.setCompletedCredits(completedCreditsSum);

            categoryDTOs.add(categoryDTO);

            totalRegisteredCourses += studentGrades.size();
            totalRegisteredCredits += studentGrades.stream().mapToDouble(StudentGrade::getCredits).sum();
        }

        reportDTO.setCategories(categoryDTOs);
        reportDTO.setTotalRegisteredCourses(totalRegisteredCourses);
        reportDTO.setTotalRegisteredCredits(totalRegisteredCredits);

        return reportDTO;
    }
}
