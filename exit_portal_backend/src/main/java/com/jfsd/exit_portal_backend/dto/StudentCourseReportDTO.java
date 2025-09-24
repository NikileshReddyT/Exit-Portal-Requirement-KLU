package com.jfsd.exit_portal_backend.dto;

import java.util.List;

public class StudentCourseReportDTO {
    private String studentId;
    private String studentName;
    private java.util.List<StudentCategoryProgressDTO> categoryProgress;
    private java.util.List<CategoryCoursesDTO> categories;
    private int totalCompletedCourses;
    private double totalCompletedCredits;

    public StudentCourseReportDTO() {}

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String studentName) { this.studentName = studentName; }

    public List<CategoryCoursesDTO> getCategories() { return categories; }
    public void setCategories(List<CategoryCoursesDTO> categories) { this.categories = categories; }

    public int getTotalCompletedCourses() { return totalCompletedCourses; }
    public void setTotalCompletedCourses(int totalCompletedCourses) { this.totalCompletedCourses = totalCompletedCourses; }

    public double getTotalCompletedCredits() { return totalCompletedCredits; }
    public void setTotalCompletedCredits(double totalCompletedCredits) { this.totalCompletedCredits = totalCompletedCredits; }

    public java.util.List<StudentCategoryProgressDTO> getCategoryProgress() { return categoryProgress; }
    public void setCategoryProgress(java.util.List<StudentCategoryProgressDTO> categoryProgress) { this.categoryProgress = categoryProgress; }
}
