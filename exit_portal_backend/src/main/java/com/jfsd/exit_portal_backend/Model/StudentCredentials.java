package com.jfsd.exit_portal_backend.Model;

// Deprecated: replaced by Student entity using student_id as primary key.
// This class is intentionally left as a simple POJO (no JPA annotations)
// to avoid entity mapping conflicts.

public class StudentCredentials {
    
    private Long id;
    
    private String studentId;
    private String password;

    public StudentCredentials() {}

    public StudentCredentials(String studentId, String password) {
        this.studentId = studentId;
        this.password = password;
    }

    // Getters and Setters
    public Long getId() { return id; }
    public void setId(Long id) { this.id = id; }

    public String getStudentId() { return studentId; }
    public void setStudentId(String studentId) { this.studentId = studentId; }

    public String getPassword() { return password; }
    public void setPassword(String password) { this.password = password; }
}
