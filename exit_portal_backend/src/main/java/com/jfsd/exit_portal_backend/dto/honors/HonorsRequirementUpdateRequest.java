package com.jfsd.exit_portal_backend.dto.honors;

public class HonorsRequirementUpdateRequest {
    private Long requirementId;
    private Double honorsMinCredits;

    public HonorsRequirementUpdateRequest() {
    }

    public HonorsRequirementUpdateRequest(Long requirementId, Double honorsMinCredits) {
        this.requirementId = requirementId;
        this.honorsMinCredits = honorsMinCredits;
    }

    public Long getRequirementId() {
        return requirementId;
    }

    public void setRequirementId(Long requirementId) {
        this.requirementId = requirementId;
    }

    public Double getHonorsMinCredits() {
        return honorsMinCredits;
    }

    public void setHonorsMinCredits(Double honorsMinCredits) {
        this.honorsMinCredits = honorsMinCredits;
    }
}
