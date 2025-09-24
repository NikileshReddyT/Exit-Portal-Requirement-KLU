package com.jfsd.exit_portal_backend.dto;

public class UpdateAdminRequest {
    private String name;            // optional
    private String password;        // optional, if present -> reset
    private String role;            // optional: ADMIN | SUPER_ADMIN
    private Long programId;         // optional, required if role=ADMIN
    private Boolean enabled;        // optional

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }

    public Boolean getEnabled() { return enabled; }
    public void setEnabled(Boolean enabled) { this.enabled = enabled; }
}
