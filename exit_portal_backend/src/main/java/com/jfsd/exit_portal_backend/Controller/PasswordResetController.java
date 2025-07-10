package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.RequestBodies.PasswordResetRequest;
import com.jfsd.exit_portal_backend.Service.PasswordResetService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/password")
public class PasswordResetController {

    @Autowired
    private PasswordResetService passwordResetService;

    @PostMapping("/forgot")
    public ResponseEntity<?> forgotPassword(@RequestBody Map<String, String> request) {
        try {
            String universityId = request.get("universityId");
            passwordResetService.createPasswordResetTokenForUser(universityId);
            return ResponseEntity.ok(Map.of("message", "Password reset link sent to your university email."));
        } catch (RuntimeException e) {
            return ResponseEntity.badRequest().body(Map.of("error", e.getMessage()));
        }
    }

    @PostMapping("/reset")
    public ResponseEntity<?> resetPassword(@RequestBody PasswordResetRequest request) {
        String validationResult = passwordResetService.validatePasswordResetToken(request.getToken());
        if (validationResult != null) {
            return ResponseEntity.badRequest().body(Map.of("error", "Invalid or expired token."));
        }

        passwordResetService.resetPassword(request.getToken(), request.getNewPassword());
        return ResponseEntity.ok(Map.of("message", "Password has been reset successfully."));
    }
}
