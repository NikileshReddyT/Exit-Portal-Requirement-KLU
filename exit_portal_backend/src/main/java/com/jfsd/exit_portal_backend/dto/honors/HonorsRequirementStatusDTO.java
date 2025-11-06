package com.jfsd.exit_portal_backend.dto.honors;

public class HonorsRequirementStatusDTO {
    private String categoryName;
    private Double honorsMinCredits;
    private Double completedCredits;
    private boolean met;

    public HonorsRequirementStatusDTO() {}

    public HonorsRequirementStatusDTO(String categoryName, Double honorsMinCredits, Double completedCredits, boolean met) {
        this.categoryName = categoryName;
        this.honorsMinCredits = honorsMinCredits;
        this.completedCredits = completedCredits;
        this.met = met;
    }

    public String getCategoryName() {
        return categoryName;
    }

    public void setCategoryName(String categoryName) {
        this.categoryName = categoryName;
    }

    public Double getHonorsMinCredits() {
        return honorsMinCredits;
    }

    public void setHonorsMinCredits(Double honorsMinCredits) {
        this.honorsMinCredits = honorsMinCredits;
    }

    public Double getCompletedCredits() {
        return completedCredits;
    }

    public void setCompletedCredits(Double completedCredits) {
        this.completedCredits = completedCredits;
    }

    public boolean isMet() {
        return met;
    }

    public void setMet(boolean met) {
        this.met = met;
    }
}
