package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Service.AdminMaintenanceService;
import com.jfsd.exit_portal_backend.security.JwtUtil;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.cache.CacheManager;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/maintenance")
public class AdminMaintenanceController {

    @Autowired
    private AdminMaintenanceService adminMaintenanceService;

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private CacheManager cacheManager;

    /**
     * Destructive: Deletes all data for a program.
     * Admins can only delete their own program. Super admins can specify programCode or programName.
     * Accepts either query params or JSON body with fields { programCode?, programName? }.
     */
    @DeleteMapping("/program")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<?> deleteProgram(
            @RequestParam(value = "programCode", required = false) String programCode,
            @RequestParam(value = "programName", required = false) String programName,
            HttpServletRequest request,
            @RequestBody(required = false) Map<String, Object> body
    ) {
        // Fallback to body fields if not provided as query params
        if ((programCode == null || programCode.isBlank()) && body != null && body.get("programCode") instanceof String) {
            programCode = (String) body.get("programCode");
        }
        if ((programName == null || programName.isBlank()) && body != null && body.get("programName") instanceof String) {
            programName = (String) body.get("programName");
        }

        String jwt = getJwtFromRequest(request);
        if (jwt == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No JWT token found"));
        }
        String userType = jwtUtil.getUserTypeFromJwtToken(jwt);
        Long userProgramId = jwtUtil.getProgramIdFromJwtToken(jwt);

        try {
            String message;
            if ("ADMIN".equals(userType)) {
                // Admins can only delete their own program
                message = adminMaintenanceService.deleteProgramCascadeById(userProgramId);
            } else if ("SUPER_ADMIN".equals(userType)) {
                if ((programCode == null || programCode.isBlank()) && (programName == null || programName.isBlank())) {
                    return ResponseEntity.badRequest().body(Map.of("error", "Provide programCode or programName"));
                }
                message = adminMaintenanceService.deleteProgramCascade(programCode, programName);
            } else {
                return ResponseEntity.status(403).body(Map.of("error", "Forbidden"));
            }
            // Evict admin insights cache so dashboards refresh immediately after deletion
            if (cacheManager != null && cacheManager.getCache("admin_api") != null) {
                cacheManager.getCache("admin_api").clear();
            }
            Map<String, Object> response = new HashMap<>();
            response.put("status", "success");
            response.put("message", message);
            return ResponseEntity.ok(response);
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body(Map.of("error", ex.getMessage()));
        } catch (Exception ex) {
            return ResponseEntity.status(500).body(Map.of("error", "Deletion failed: " + ex.getMessage()));
        }
    }

    private String getJwtFromRequest(HttpServletRequest request) {
        String jwt = getJwtFromCookie(request);
        if (jwt != null && !jwt.isBlank()) return jwt;
        String authHeader = request.getHeader("Authorization");
        if (authHeader != null && authHeader.regionMatches(true, 0, "Bearer ", 0, 7)) {
            return authHeader.substring(7).trim();
        }
        return null;
    }

    private String getJwtFromCookie(HttpServletRequest request) {
        Cookie[] cookies = request.getCookies();
        if (cookies != null) {
            for (Cookie cookie : cookies) {
                if ("jwt".equals(cookie.getName())) {
                    return cookie.getValue();
                }
            }
        }
        return null;
    }
}
