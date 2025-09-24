package com.jfsd.exit_portal_backend.dto.category;

public class IncompleteStudentDetailDTO {
    private Integer minRequiredCourses;
    private Double minRequiredCredits;
    private Integer completedCourses;
    private Double completedCredits;
    private Integer registeredCourses;
    private Double registeredCredits;
    private Integer missingCourses;
    private Double missingCredits;

    public IncompleteStudentDetailDTO() {}

    public IncompleteStudentDetailDTO(Integer minRequiredCourses, Double minRequiredCredits,
                                      Integer completedCourses, Double completedCredits,
                                      Integer registeredCourses, Double registeredCredits,
                                      Integer missingCourses, Double missingCredits) {
        this.minRequiredCourses = minRequiredCourses;
        this.minRequiredCredits = minRequiredCredits;
        this.completedCourses = completedCourses;
        this.completedCredits = completedCredits;
        this.registeredCourses = registeredCourses;
        this.registeredCredits = registeredCredits;
        this.missingCourses = missingCourses;
        this.missingCredits = missingCredits;
    }

    public Integer getMinRequiredCourses() { return minRequiredCourses; }
    public void setMinRequiredCourses(Integer v) { this.minRequiredCourses = v; }

    public Double getMinRequiredCredits() { return minRequiredCredits; }
    public void setMinRequiredCredits(Double v) { this.minRequiredCredits = v; }

    public Integer getCompletedCourses() { return completedCourses; }
    public void setCompletedCourses(Integer v) { this.completedCourses = v; }

    public Double getCompletedCredits() { return completedCredits; }
    public void setCompletedCredits(Double v) { this.completedCredits = v; }

    public Integer getRegisteredCourses() { return registeredCourses; }
    public void setRegisteredCourses(Integer v) { this.registeredCourses = v; }

    public Double getRegisteredCredits() { return registeredCredits; }
    public void setRegisteredCredits(Double v) { this.registeredCredits = v; }

    public Integer getMissingCourses() { return missingCourses; }
    public void setMissingCourses(Integer v) { this.missingCourses = v; }

    public Double getMissingCredits() { return missingCredits; }
    public void setMissingCredits(Double v) { this.missingCredits = v; }
}
