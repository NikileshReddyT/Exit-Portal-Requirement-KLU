package com.jfsd.exit_portal_backend.Model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.AUTO)
    private Long id;

    private String token;

    @OneToOne(targetEntity = StudentCredentials.class, fetch = FetchType.EAGER)
    @JoinColumn(nullable = false, name = "student_credentials_id")
    private StudentCredentials student;

    private Date expiryDate;

    public PasswordResetToken() {}

    public PasswordResetToken(String token, StudentCredentials student) {
        this.token = token;
        this.student = student;
        // Token expires in 1 hour
        this.expiryDate = new Date(System.currentTimeMillis() + 3600000);
    }

    public Long getId() {
        return id;
    }

    public void setId(Long id) {
        this.id = id;
    }

    public String getToken() {
        return token;
    }

    public void setToken(String token) {
        this.token = token;
    }

    public StudentCredentials getStudent() {
        return student;
    }

    public void setStudent(StudentCredentials student) {
        this.student = student;
    }

    public Date getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(Date expiryDate) {
        this.expiryDate = expiryDate;
    }
}
