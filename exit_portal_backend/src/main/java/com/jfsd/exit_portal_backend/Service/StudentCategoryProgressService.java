package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.*;
import com.jfsd.exit_portal_backend.Repository.*;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Collections;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
public class StudentCategoryProgressService {

    @Autowired
    private StudentCategoryProgressRepository progressRepository;
    
    @Autowired
    private StudentGradeRepository studentGradeRepository;
    
    @Autowired
    private CategoriesRepository categoriesRepository;

    @Autowired
    private CoursesRepository coursesRepository;

    @Transactional
    public void calculateAndUpdateProgressForStudents(Set<String> universityIds) {
        if (universityIds == null || universityIds.isEmpty()) {
            return;
        }

        // Fetch all necessary data in bulk to avoid multiple database calls
        List<StudentGrade> relevantGrades = studentGradeRepository.findByUniversityIdIn(universityIds);
        List<Categories> allCategories = categoriesRepository.findAll();
        Map<String, List<Courses>> coursesByCategory = coursesRepository.findAll().stream()
                .collect(Collectors.groupingBy(Courses::getCategory));

        Map<String, List<StudentGrade>> gradesByStudent = relevantGrades.stream()
                .collect(Collectors.groupingBy(StudentGrade::getUniversityId));

        // Process each student
        for (String universityId : universityIds) {
            List<StudentGrade> studentGrades = gradesByStudent.getOrDefault(universityId, Collections.emptyList());

            // Delete existing progress records for the student to ensure a clean slate
            progressRepository.deleteByUniversityId(universityId);

            if (studentGrades.isEmpty()) {
                continue; // No grades for this student, so no progress to calculate
            }

            String studentName = studentGrades.get(0).getStudentName();

            // Process each category for the student
            for (Categories category : allCategories) {
                List<Courses> categoryCourses = coursesByCategory.getOrDefault(category.getCategoryName(), Collections.emptyList());
                Set<String> categoryCourseCodes = categoryCourses.stream()
                        .map(Courses::getCourseCode)
                        .collect(Collectors.toSet());

                List<StudentGrade> completedCourses = studentGrades.stream()
                        .filter(grade -> categoryCourseCodes.contains(grade.getCourseCode()))
                        .filter(grade -> "P".equals(grade.getPromotion()))
                        .collect(Collectors.toList());

                int completedCourseCount = completedCourses.size();
                double completedCreditsSum = completedCourses.stream()
                        .mapToDouble(StudentGrade::getCredits)
                        .sum();

                StudentCategoryProgress progress = new StudentCategoryProgress(
                    universityId,
                    studentName,
                    category.getCategoryName(),
                    category.getMinCredits(),
                    category.getMinCourses(),
                    completedCourseCount,
                    completedCreditsSum
                );

                progressRepository.save(progress);
            }
        }
    }

    @Transactional
    public void calculateAndUpdateProgress() {
        // Fetch all unique student IDs and delegate to the specific method
        Set<String> allStudentIds = studentGradeRepository.findAllUniqueStudentIds().stream().collect(Collectors.toSet());
        calculateAndUpdateProgressForStudents(allStudentIds);
    }
    
    
    
    public List<StudentCategoryProgress> getStudentProgress(String universityId) {
        return progressRepository.findByUniversityId(universityId);
    }

    public List<StudentCategoryProgress> getAllProgress() {
        return progressRepository.findAll();
    }
}
