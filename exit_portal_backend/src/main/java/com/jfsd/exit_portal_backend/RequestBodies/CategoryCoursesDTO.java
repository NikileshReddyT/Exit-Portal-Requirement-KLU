package com.jfsd.exit_portal_backend.RequestBodies;

import java.util.List;

import com.jfsd.exit_portal_backend.Model.StudentGrade;

// DTO for each category and its courses
public class CategoryCoursesDTO {
    private String categoryName;
    private int minRequiredCourses;
    private int registeredCourses;
    private double minRequiredCredits;
    private double registeredCredits;
    private int completedCourses;
    private double completedCredits;
    private List<StudentGrade> courses;

    // Constructors
    public CategoryCoursesDTO() {}

    // Getters and Setters
    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    public int getMinRequiredCourses() {
        return minRequiredCourses;
    }

    public void setMinRequiredCourses(int minRequiredCourses) {
        this.minRequiredCourses = minRequiredCourses;
    }

    public int getRegisteredCourses() {
        return registeredCourses;
    }

    public void setRegisteredCourses(int registeredCourses) {
        this.registeredCourses = registeredCourses;
    }

    public double getMinRequiredCredits() {
        return minRequiredCredits;
    }

    public void setMinRequiredCredits(double minRequiredCredits) {
        this.minRequiredCredits = minRequiredCredits;
    }

    public double getRegisteredCredits() {
        return registeredCredits;
    }

    public void setRegisteredCredits(double registeredCredits) {
        this.registeredCredits = registeredCredits;
    }

    public int getCompletedCourses() {
        return completedCourses;
    }

    public void setCompletedCourses(int completedCourses) {
        this.completedCourses = completedCourses;
    }

    public double getCompletedCredits() {
        return completedCredits;
    }

    public void setCompletedCredits(double completedCredits) {
        this.completedCredits = completedCredits;
    }

    public List<StudentGrade> getCourses() {
        return courses;
    }

    public void setCourses(List<StudentGrade> courses) {
        this.courses = courses;
    }
}
