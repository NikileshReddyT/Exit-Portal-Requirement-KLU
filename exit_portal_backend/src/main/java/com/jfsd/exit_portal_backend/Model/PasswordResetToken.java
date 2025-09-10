package com.jfsd.exit_portal_backend.Model;

import jakarta.persistence.*;
import java.util.Date;

@Entity
@Table(
    name = "password_reset_token",
    indexes = {
        @Index(name = "idx_prt_token", columnList = "token"),
        @Index(name = "idx_prt_student", columnList = "student_id"),
        @Index(name = "idx_prt_expiry", columnList = "expiryDate")
    }
)
public class PasswordResetToken {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    private String token;

    @OneToOne(fetch = FetchType.EAGER)
    @JoinColumn(nullable = false, name = "student_id")
    private Student student;

    private Date expiryDate;

    public static final int EXPIRATION = 3600000; // 1 hour in milliseconds

    private Date calculateExpiryDate(int expiration) {
        return new Date(System.currentTimeMillis() + expiration);
    }

    public PasswordResetToken() {}

    public PasswordResetToken(String token, Student student) {
        this.token = token;
        this.student = student;
        this.expiryDate = calculateExpiryDate(EXPIRATION);
    }

    public void updateToken(String newToken) {
        this.token = newToken;
        this.expiryDate = calculateExpiryDate(EXPIRATION);
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

    public Student getStudent() {
        return student;
    }

    public void setStudent(Student student) {
        this.student = student;
    }

    public Date getExpiryDate() {
        return expiryDate;
    }

    public void setExpiryDate(Date expiryDate) {
        this.expiryDate = expiryDate;
    }
}
