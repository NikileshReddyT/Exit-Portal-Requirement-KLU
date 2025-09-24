package com.jfsd.exit_portal_backend.dto.category;

public class CompletedStudentDetailDTO {
    private Integer completedCourses;
    private Double completedCredits;

    public CompletedStudentDetailDTO() {}

    public CompletedStudentDetailDTO(Integer completedCourses, Double completedCredits) {
        this.completedCourses = completedCourses;
        this.completedCredits = completedCredits;
    }

    public Integer getCompletedCourses() {
        return completedCourses;
    }

    public void setCompletedCourses(Integer completedCourses) {
        this.completedCourses = completedCourses;
    }

    public Double getCompletedCredits() {
        return completedCredits;
    }

    public void setCompletedCredits(Double completedCredits) {
        this.completedCredits = completedCredits;
    }
}
