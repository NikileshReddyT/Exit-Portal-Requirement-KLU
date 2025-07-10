package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.PasswordResetToken;
import com.jfsd.exit_portal_backend.Model.StudentCredentials;
import com.jfsd.exit_portal_backend.Repository.PasswordResetTokenRepository;
import com.jfsd.exit_portal_backend.Repository.StudentCredentialsRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Calendar;
import java.util.UUID;

@Service
public class PasswordResetService {

    @Autowired
    private StudentCredentialsRepository studentCredentialsRepository;

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public void createPasswordResetTokenForUser(String universityId) {
        StudentCredentials student = studentCredentialsRepository.findByStudentId(universityId)
                .orElseThrow(() -> new RuntimeException("User not found"));
        String token = UUID.randomUUID().toString();
        PasswordResetToken myToken = new PasswordResetToken(token, student);
        tokenRepository.save(myToken);
        emailService.sendPasswordResetEmail(student.getStudentId() + "@kluniversity.in", token);
    }

    public String validatePasswordResetToken(String token) {
        final PasswordResetToken passToken = tokenRepository.findByToken(token);

        return !isTokenFound(passToken) ? "invalidToken"
                : isTokenExpired(passToken) ? "expired"
                : null;
    }

    public void resetPassword(String token, String newPassword) {
        PasswordResetToken passToken = tokenRepository.findByToken(token);
        StudentCredentials student = passToken.getStudent();
        String hashedPassword = passwordEncoder.encode(newPassword);
        student.setPassword(hashedPassword);
        studentCredentialsRepository.save(student);
        tokenRepository.delete(passToken);
    }

    private boolean isTokenFound(PasswordResetToken passToken) {
        return passToken != null;
    }

    private boolean isTokenExpired(PasswordResetToken passToken) {
        final Calendar cal = Calendar.getInstance();
        return passToken.getExpiryDate().before(cal.getTime());
    }
}
