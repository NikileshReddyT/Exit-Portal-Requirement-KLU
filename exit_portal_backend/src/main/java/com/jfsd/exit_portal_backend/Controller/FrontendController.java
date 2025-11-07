package com.jfsd.exit_portal_backend.Controller;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.UUID;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseCookie;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.RestController;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

import com.jfsd.exit_portal_backend.Model.Courses;
import com.jfsd.exit_portal_backend.dto.StudentCategoryProgressDTO;
import com.jfsd.exit_portal_backend.Model.StudentGrade;
import com.jfsd.exit_portal_backend.dto.InvalidPasswordException;
import com.jfsd.exit_portal_backend.dto.Login;
import com.jfsd.exit_portal_backend.dto.Student;
import com.jfsd.exit_portal_backend.dto.StudentCourseReportDTO;
import com.jfsd.exit_portal_backend.dto.UserNotFoundException;
import com.jfsd.exit_portal_backend.Service.FrontendService;
import com.jfsd.exit_portal_backend.Service.AdminUserService;
import com.jfsd.exit_portal_backend.security.JwtUtil;
import com.jfsd.exit_portal_backend.Model.AdminUser;
import jakarta.servlet.http.HttpServletResponse;
import java.time.Duration;

@RestController
@RequestMapping("/api/v1/frontend")
public class FrontendController {

    private static final Logger logger = LoggerFactory.getLogger(FrontendController.class);

    @Autowired
    private FrontendService frontendService;
    
    @Autowired
    private AdminUserService adminUserService;
    
    @Autowired
    private JwtUtil jwtUtil;
    
    @Value("${APP_ENV:dev}")
    private String appEnv;
    
    @Value("${COOKIE_DOMAIN:}")
    private String cookieDomain;

    @GetMapping("/")
    public String index() {
        return "Hello World";
    }

    @PostMapping("/getdata")
    public ResponseEntity<List<StudentCategoryProgressDTO>> getdata(@RequestBody Student request) {
        System.out.println(request.getUniversityId());
        return ResponseEntity.ok(frontendService.getStudentCategoryProgress(request.getUniversityId()));
    }

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Login login, HttpServletResponse response) {
        logger.info("Unified login attempt for ID: {}", login.getUniversityId());
        
        try {
            // First try admin authentication
            try {
                AdminUser adminUser = adminUserService.authenticateAdmin(login.getUniversityId(), login.getPassword());
                logger.info("Admin login successful for username: {}", login.getUniversityId());
                
                // Generate JWT token for admin
                String userType = adminUser.getRole().name(); // ADMIN or SUPER_ADMIN
                Long programId = adminUser.getProgram() != null ? adminUser.getProgram().getProgramId() : null;
                String jwt = jwtUtil.generateJwtToken(adminUser.getUsername(), adminUser.getRole().name(), programId, userType);
                
                // Set JWT as HttpOnly cookie (prod: Secure + SameSite=None)
                setJwtCookie(response, jwt, 24 * 60 * 60);
                
                // Return admin user info
                Map<String, Object> adminResponse = new HashMap<>();
                adminResponse.put("userType", userType);
                adminResponse.put("role", adminUser.getRole().name());
                adminResponse.put("username", adminUser.getUsername());
                adminResponse.put("name", adminUser.getName());
                // Also return token so frontend can use Authorization header (helps Safari)
                adminResponse.put("token", jwt);
                adminResponse.put("tokenType", "Bearer");
                if (adminUser.getProgram() != null) {
                    adminResponse.put("programId", adminUser.getProgram().getProgramId());
                    adminResponse.put("programCode", adminUser.getProgram().getCode());
                    adminResponse.put("programName", adminUser.getProgram().getName());
                }
                
                return ResponseEntity.ok(adminResponse);
                
            } catch (UserNotFoundException | InvalidPasswordException e) {
                // Admin auth failed, try student authentication
                logger.info("Admin auth failed, trying student auth for ID: {}", login.getUniversityId());
                
                Student student = frontendService.authenticateStudent(login.getUniversityId(), login.getPassword());
                logger.info("Student login successful for university ID: {}", login.getUniversityId());
                
                // Generate JWT token for student
                String jwt = jwtUtil.generateJwtToken(student.getUniversityId(), "STUDENT", null, "STUDENT");
                
                // Set JWT as HttpOnly cookie (prod: Secure + SameSite=None)
                setJwtCookie(response, jwt, 24 * 60 * 60);
                
                // Return student info
                Map<String, Object> studentResponse = new HashMap<>();
                studentResponse.put("userType", "STUDENT");
                studentResponse.put("role", "STUDENT");
                studentResponse.put("universityId", student.getUniversityId());
                studentResponse.put("studentName", student.getStudentName());
                // Also return token so frontend can use Authorization header (helps Safari)
                studentResponse.put("token", jwt);
                studentResponse.put("tokenType", "Bearer");
                
                return ResponseEntity.ok(studentResponse);
            }
            
        } catch (UserNotFoundException | InvalidPasswordException e) {
            logger.error("Login failed for ID: {}. Reason: {}", login.getUniversityId(), e.getMessage());
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(e.getMessage());
        } catch (Exception e) {
            logger.error("An unexpected error occurred during login for ID: {}", login.getUniversityId(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body("An unexpected error occurred. Please try again later.");
        }
    }
    

    @GetMapping("/getcategorydetails/{categoryName}/{studentId}")
    public ResponseEntity<List<StudentGrade>> getCategoryDetails(@PathVariable("categoryName") String categoryName, @PathVariable("studentId") String studentId) {
        System.out.println("Category Name: " + categoryName);
        System.out.println("Student ID: " + studentId);
        List<StudentGrade> courses = frontendService.getCoursesByCategory(studentId, categoryName);
        System.out.println(courses);
        return new ResponseEntity<>(courses, HttpStatus.OK);
    }

    @GetMapping("/getallcourses/{categoryName}")
    public ResponseEntity<List<Courses>> getAllCourses(
            @PathVariable("categoryName") String categoryName,
            @RequestParam(value = "studentId", required = false) String studentId,
            @RequestParam(value = "programId", required = false) Long programId
    ) {
        List<Courses> allCourses = frontendService.getAllCoursesByCategoryScoped(categoryName, studentId, programId);
        return new ResponseEntity<>(allCourses, HttpStatus.OK);
    }

    @PostMapping("/generatereport")
    public ResponseEntity<StudentCourseReportDTO> generateStudentReport(@RequestBody Map<String, String> requestBody) {
        String _reqId = UUID.randomUUID().toString().substring(0, 8);
        logger.info("[{}] Enter /generatereport on thread {}", _reqId, Thread.currentThread().getName());
        String universityId = null;
        if (requestBody != null) {
            universityId = requestBody.get("universityId");
            if (universityId == null || universityId.isBlank()) universityId = requestBody.get("universityid");
            if (universityId == null || universityId.isBlank()) universityId = requestBody.get("studentId");
            if (universityId == null || universityId.isBlank()) universityId = requestBody.get("id");
        }
        if (universityId == null || universityId.isBlank()) {
            return ResponseEntity.badRequest().body(null);
        }

        StudentCourseReportDTO reportDTO = frontendService.generateStudentReport(universityId);
        logger.info("[{}] Exit /generatereport for student {}", _reqId, universityId);
        return ResponseEntity.ok(reportDTO);
    }
    
    @PostMapping("/logout")
    public ResponseEntity<?> logout(HttpServletResponse response) {
        // Clear JWT cookie (prod: Secure + SameSite=None)
        setJwtCookie(response, "", 0); // Expire immediately
        
        return ResponseEntity.ok(Map.of("message", "Logged out successfully"));
    }

    private void setJwtCookie(HttpServletResponse response, String value, int maxAgeSeconds) {
        boolean isProd = "prod".equalsIgnoreCase(appEnv) || "production".equalsIgnoreCase(appEnv);
        String sameSite = isProd ? "None" : "Lax";

        ResponseCookie.ResponseCookieBuilder builder = ResponseCookie.from("jwt", value)
                .httpOnly(true)
                .path("/")
                .sameSite(sameSite)
                .maxAge(Duration.ofSeconds(maxAgeSeconds));

        // Safari requires Secure when SameSite=None and HTTPS in production
        if (isProd) {
            builder = builder.secure(true);
            if (cookieDomain != null && !cookieDomain.isBlank()) {
                // e.g., COOKIE_DOMAIN=your-backend-domain.com (no scheme)
                builder = builder.domain(cookieDomain.trim());
            }
        }

        ResponseCookie cookie = builder.build();
        response.addHeader(HttpHeaders.SET_COOKIE, cookie.toString());
    }
}
