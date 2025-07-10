package com.jfsd.exit_portal_backend.Service;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.mail.SimpleMailMessage;
import org.springframework.mail.javamail.JavaMailSender;
import org.springframework.stereotype.Service;

@Service
public class EmailService {

    @Autowired
    private JavaMailSender mailSender;

    public void sendPasswordResetEmail(String to, String token) {
        SimpleMailMessage message = new SimpleMailMessage();
        message.setTo(to);
        message.setSubject("KL University - Password Reset Request");
        message.setText("Dear Student,\n\n" +
                "We received a request to reset your password for the KL University Exit Portal.\n\n" +
                "To reset your password, please click on the link below:\n" +
                "https://exitportal-klu.vercel.app/reset-password?token=" + token + "\n\n" +
                "This link will expire in 1 hour for security reasons.\n\n" +
                "If you did not request a password reset, please ignore this email or contact support if you have concerns.\n\n" +
                "Regards,\nKL University Exit Portal Team");
        mailSender.send(message);
    }
}
