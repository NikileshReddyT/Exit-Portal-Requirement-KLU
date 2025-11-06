package com.jfsd.exit_portal_backend.dto.honors;

import java.util.List;

public class StudentHonorsStatusDTO {
    private String studentId;
    private String studentName;
    private boolean eligible;
    private boolean hasAnyFailure;
    private List<HonorsRequirementStatusDTO> categoryStatuses;

    public StudentHonorsStatusDTO() {}

    public StudentHonorsStatusDTO(String studentId, String studentName, boolean eligible, boolean hasAnyFailure, List<HonorsRequirementStatusDTO> categoryStatuses) {
        this.studentId = studentId;
        this.studentName = studentName;
        this.eligible = eligible;
        this.hasAnyFailure = hasAnyFailure;
        this.categoryStatuses = categoryStatuses;
    }

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

    public boolean isEligible() {
        return eligible;
    }

    public void setEligible(boolean eligible) {
        this.eligible = eligible;
    }

    public boolean isHasAnyFailure() {
        return hasAnyFailure;
    }

    public void setHasAnyFailure(boolean hasAnyFailure) {
        this.hasAnyFailure = hasAnyFailure;
    }

    public List<HonorsRequirementStatusDTO> getCategoryStatuses() {
        return categoryStatuses;
    }

    public void setCategoryStatuses(List<HonorsRequirementStatusDTO> categoryStatuses) {
        this.categoryStatuses = categoryStatuses;
    }
}
