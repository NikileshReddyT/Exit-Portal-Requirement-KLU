package com.jfsd.exit_portal_backend.dto.category;

public class CompletedStudentDTO {
    private String universityId;
    private String studentName;
    private Integer completedCourses;
    private Double completedCredits;

    public CompletedStudentDTO() {}

    public CompletedStudentDTO(String universityId, String studentName, Integer completedCourses, Double completedCredits) {
        this.universityId = universityId;
        this.studentName = studentName;
        this.completedCourses = completedCourses;
        this.completedCredits = completedCredits;
    }

    public String getUniversityId() { return universityId; }
    public void setUniversityId(String v) { this.universityId = v; }

    public String getStudentName() { return studentName; }
    public void setStudentName(String v) { this.studentName = v; }

    public Integer getCompletedCourses() { return completedCourses; }
    public void setCompletedCourses(Integer v) { this.completedCourses = v; }

    public Double getCompletedCredits() { return completedCredits; }
    public void setCompletedCredits(Double v) { this.completedCredits = v; }
}
