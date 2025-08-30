package com.jfsd.exit_portal_backend.RequestBodies;

public class CreateAdminRequest {
    private String username;
    private String name;
    private String password;
    private String role; // "ADMIN" or "SUPER_ADMIN"
    private Long programId; // optional for SUPER_ADMIN

    public String getUsername() { return username; }
    public void setUsername(String username) { this.username = username; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }

    public String getRole() { return role; }
    public void setRole(String role) { this.role = role; }

    public Long getProgramId() { return programId; }
    public void setProgramId(Long programId) { this.programId = programId; }
}
