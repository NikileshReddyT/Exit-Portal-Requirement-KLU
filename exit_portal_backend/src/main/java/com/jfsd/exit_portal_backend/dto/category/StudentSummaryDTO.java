package com.jfsd.exit_portal_backend.dto.category;

public class StudentSummaryDTO {
    private String universityId;
    private String studentName;

    public StudentSummaryDTO() {}

    public StudentSummaryDTO(String universityId, String studentName) {
        this.universityId = universityId;
        this.studentName = studentName;
    }

    public String getUniversityId() {
        return universityId;
    }

    public void setUniversityId(String universityId) {
        this.universityId = universityId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }
}
