package com.jfsd.exit_portal_backend.RequestBodies;

import java.util.List;

// Main response DTO containing student info and all categories
public class StudentCourseReportDTO {
    private String studentId;
    private String studentName;
    private List<StudentCategoryProgressDTO> categoryProgress;
    private List<CategoryCoursesDTO> categories;
    private int totalCompletedCourses;
    private double totalCompletedCredits;

    // Constructors
    public StudentCourseReportDTO() {}

    // Getters and Setters
    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public List<CategoryCoursesDTO> getCategories() {
        return categories;
    }

    public void setCategories(List<CategoryCoursesDTO> categories) {
        this.categories = categories;
    }

    public int getTotalCompletedCourses() {
        return totalCompletedCourses;
    }

    public void setTotalCompletedCourses(int totalCompletedCourses) {
        this.totalCompletedCourses = totalCompletedCourses;
    }

    public double getTotalCompletedCredits() {
        return totalCompletedCredits;
    }

    public void setTotalCompletedCredits(double totalCompletedCredits) {
        this.totalCompletedCredits = totalCompletedCredits;
    }
    public List<StudentCategoryProgressDTO> getCategoryProgress() {
        return categoryProgress;
    }

    public void setCategoryProgress(List<StudentCategoryProgressDTO> categoryProgress) {
        this.categoryProgress = categoryProgress;
    }
}
