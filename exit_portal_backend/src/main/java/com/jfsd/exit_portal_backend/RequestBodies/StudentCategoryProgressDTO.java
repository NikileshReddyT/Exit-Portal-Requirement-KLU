package com.jfsd.exit_portal_backend.RequestBodies;

public class StudentCategoryProgressDTO {

    private String categoryName;
    private int minRequiredCourses;
    private double minRequiredCredits;
    private long registeredCourses;
    private double registeredCredits;
    private long completedCourses;
    private double completedCredits;

    public StudentCategoryProgressDTO(String categoryName, int minRequiredCourses, double minRequiredCredits, long registeredCourses, Double registeredCredits, long completedCourses, Double completedCredits) {
        this.categoryName = categoryName;
        this.minRequiredCourses = minRequiredCourses;
        this.minRequiredCredits = minRequiredCredits;
        this.registeredCourses = registeredCourses;
        this.registeredCredits = (registeredCredits != null) ? registeredCredits : 0.0;
        this.completedCourses = completedCourses;
        this.completedCredits = (completedCredits != null) ? completedCredits : 0.0;
    }

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

    public double getMinRequiredCredits() {
        return minRequiredCredits;
    }

    public void setMinRequiredCredits(double minRequiredCredits) {
        this.minRequiredCredits = minRequiredCredits;
    }

    public long getRegisteredCourses() {
        return registeredCourses;
    }

    public void setRegisteredCourses(long registeredCourses) {
        this.registeredCourses = registeredCourses;
    }

    public double getRegisteredCredits() {
        return registeredCredits;
    }

    public void setRegisteredCredits(double registeredCredits) {
        this.registeredCredits = registeredCredits;
    }

    public long getCompletedCourses() {
        return completedCourses;
    }

    public void setCompletedCourses(long completedCourses) {
        this.completedCourses = completedCourses;
    }

    public double getCompletedCredits() {
        return completedCredits;
    }

    public void setCompletedCredits(double completedCredits) {
        this.completedCredits = completedCredits;
    }
}
