package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.PasswordResetToken;
import com.jfsd.exit_portal_backend.Model.Student;
import com.jfsd.exit_portal_backend.Repository.PasswordResetTokenRepository;
import com.jfsd.exit_portal_backend.Repository.StudentRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

import java.util.Calendar;
import java.util.UUID;

@Service
public class PasswordResetService {

    @Autowired
    private StudentRepository studentRepository;

    @Autowired
    private PasswordResetTokenRepository tokenRepository;

    @Autowired
    private EmailService emailService;

    @Autowired
    private PasswordEncoder passwordEncoder;

    public void createPasswordResetTokenForUser(String universityId) {
        Student student = studentRepository.findByStudentId(universityId)
                .orElseThrow(() -> new RuntimeException("User not found"));

        PasswordResetToken myToken = tokenRepository.findByStudent(student);

        if (myToken == null) {
            myToken = new PasswordResetToken();
            myToken.setStudent(student);
        }

        myToken.updateToken(UUID.randomUUID().toString());
        tokenRepository.save(myToken);

        emailService.sendPasswordResetEmail(student.getStudentId() + "@kluniversity.in", myToken.getToken());
    }

    public String validatePasswordResetToken(String token) {
        final PasswordResetToken passToken = tokenRepository.findByToken(token);

        return !isTokenFound(passToken) ? "invalidToken"
                : isTokenExpired(passToken) ? "expired"
                : null;
    }

    public void resetPassword(String token, String newPassword) {
        PasswordResetToken passToken = tokenRepository.findByToken(token);
        Student student = passToken.getStudent();
        String hashedPassword = passwordEncoder.encode(newPassword);
        student.setPassword(hashedPassword);
        studentRepository.save(student);
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
