package com.jfsd.exit_portal_backend.dto.honors;

import java.util.List;

public class HonorsRequirementBulkUpdateRequest {
    private List<HonorsRequirementUpdateRequest> updates;

    public HonorsRequirementBulkUpdateRequest() {
    }

    public HonorsRequirementBulkUpdateRequest(List<HonorsRequirementUpdateRequest> updates) {
        this.updates = updates;
    }

    public List<HonorsRequirementUpdateRequest> getUpdates() {
        return updates;
    }

    public void setUpdates(List<HonorsRequirementUpdateRequest> updates) {
        this.updates = updates;
    }
}
