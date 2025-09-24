package com.jfsd.exit_portal_backend.dto;

import java.util.Map;
import java.util.List;

public class Admin {
    private int adminId;
    private String universityId;
    private List<Map<String, Integer>> adminConsolidation;

    public int getAdminId() { return adminId; }
    public void setAdminId(int adminId) { this.adminId = adminId; }

    public String getUniversityId() { return universityId; }
    public void setUniversityId(String universityId) { this.universityId = universityId; }

    public List<Map<String, Integer>> getAdminConsolidation() { return adminConsolidation; }
    public void setAdminConsolidation(List<Map<String, Integer>> adminConsolidation) { this.adminConsolidation = adminConsolidation; }
}
