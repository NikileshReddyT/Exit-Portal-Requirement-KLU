package com.jfsd.exit_portal_backend.RequestBodies;

public class incompleteCategoryCourses {
    private String courseName;
    private String courseCode;
    private double credits;
    private String categoryName;


    public incompleteCategoryCourses() {}
    public incompleteCategoryCourses(String courseName, String courseCode, double credits, String categoryName) {
        this.courseName = courseName;
        this.courseCode = courseCode;
        this.credits = credits;
        this.categoryName = categoryName;
    }

    public String getCourseName() {
        return courseName;
    }

    public void setCourseName(String courseName) {
        this.courseName = courseName;
    }

    public String getCourseCode() {
        return courseCode;
    }

    public void setCourseCode(String courseCode) {
        this.courseCode = courseCode;
    }

    public double getCredits() {
        return credits;
    }

    public void setCredits(double credits) {
        this.credits = credits;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }
 
    
}
