package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.security.JwtUtil;
import com.jfsd.exit_portal_backend.Service.AdminInsightsService;
import jakarta.servlet.http.Cookie;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.HashMap;
import java.util.List;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin")
public class AdminInsightsController {

    @Autowired
    private JwtUtil jwtUtil;

    @Autowired
    private AdminInsightsService adminInsightsService;

    @GetMapping("/dashboard")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> getDashboard(
            @RequestParam(value = "programId", required = false) Long requestProgramId,
            HttpServletRequest request) {
        String jwt = getJwtFromCookie(request);
        if (jwt == null) {
            return ResponseEntity.status(401).body("No JWT token found");
        }

        String userType = jwtUtil.getUserTypeFromJwtToken(jwt);
        String username = jwtUtil.getUsernameFromJwtToken(jwt);
        Long userProgramId = jwtUtil.getProgramIdFromJwtToken(jwt);

        // For SUPER_ADMIN, use requestProgramId if provided, otherwise show all data
        // For ADMIN, always use their assigned program
        Long effectiveProgramId = null;
        if ("SUPER_ADMIN".equals(userType)) {
            effectiveProgramId = requestProgramId; // null means show all programs
        } else {
            effectiveProgramId = userProgramId; // ADMIN sees only their program
        }

        Map<String, Object> dashboardData = adminInsightsService.buildDashboard(userType, effectiveProgramId);
        dashboardData.put("username", username);
        dashboardData.put("message", "Welcome to " + userType + " dashboard!");

        return ResponseEntity.ok(dashboardData);
    }

    @GetMapping("/me")
    @PreAuthorize("hasAnyRole('ADMIN', 'SUPER_ADMIN')")
    public ResponseEntity<?> getCurrentUser(HttpServletRequest request) {
        String jwt = getJwtFromCookie(request);
        if (jwt == null) {
            return ResponseEntity.status(401).body("No JWT token found");
        }

        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("username", jwtUtil.getUsernameFromJwtToken(jwt));
        userInfo.put("role", jwtUtil.getRoleFromJwtToken(jwt));
        userInfo.put("userType", jwtUtil.getUserTypeFromJwtToken(jwt));
        userInfo.put("programId", jwtUtil.getProgramIdFromJwtToken(jwt));

        return ResponseEntity.ok(userInfo);
    }

    // SUPER_ADMIN: list all programs (id, code, name)
    @GetMapping("/programs")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listPrograms() {
        return ResponseEntity.ok(adminInsightsService.listPrograms());
    }

    // SUPER_ADMIN: rank programs by completion rate
    @GetMapping("/programs/rank")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> rankPrograms(
            @RequestParam(name = "limit", defaultValue = "5") int limit,
            @RequestParam(name = "worstFirst", defaultValue = "true") boolean worstFirst
    ) {
        return ResponseEntity.ok(adminInsightsService.rankPrograms(limit, worstFirst));
    }

    // SUPER_ADMIN: get program details by ID
    @GetMapping("/programs/{programId}")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> getProgramById(@PathVariable("programId") Long programId) {
        return ResponseEntity.ok(adminInsightsService.getProgramById(programId));
    }

    // SUPER_ADMIN: get dashboard for a selected program
    @GetMapping("/programs/{programId}/dashboard")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> getProgramDashboard(@PathVariable("programId") Long programId) {
        return ResponseEntity.ok(adminInsightsService.buildDashboardForProgram(programId));
    }

    // Stats endpoint for dashboard
    @GetMapping("/stats")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> getStats(
            @RequestParam(value = "programId", required = false) Long requestProgramId,
            HttpServletRequest request) {
        String jwt = getJwtFromCookie(request);
        if (jwt == null) {
            return ResponseEntity.status(401).body(Map.of("error", "No JWT token found"));
        }

        String userType = jwtUtil.getUserTypeFromJwtToken(jwt);
        Long userProgramId = jwtUtil.getProgramIdFromJwtToken(jwt);

        // Apply same logic as dashboard endpoint
        Long effectiveProgramId = null;
        if ("SUPER_ADMIN".equals(userType)) {
            effectiveProgramId = requestProgramId;
        } else {
            effectiveProgramId = userProgramId;
        }
        
        return ResponseEntity.ok(adminInsightsService.getStats(effectiveProgramId));
    }

    // ===== Data Explorer Endpoints =====
    @GetMapping("/data/students")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listStudents(@RequestParam(value = "programId", required = false) Long programId) {
        return ResponseEntity.ok(adminInsightsService.listStudents(programId));
    }

    @GetMapping("/data/categories")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listCategories(@RequestParam(value = "programId", required = false) Long programId) {
        return ResponseEntity.ok(adminInsightsService.listCategories(programId));
    }

    @GetMapping("/data/courses")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listCourses(@RequestParam(value = "programId", required = false) Long programId) {
        return ResponseEntity.ok(adminInsightsService.listCourses(programId));
    }

    @GetMapping("/data/mappings")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listMappings(@RequestParam(value = "programId", required = false) Long programId) {
        return ResponseEntity.ok(adminInsightsService.listMappings(programId));
    }

    @GetMapping("/data/requirements")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listRequirements(@RequestParam(value = "programId", required = false) Long programId) {
        return ResponseEntity.ok(adminInsightsService.listRequirements(programId));
    }

    @GetMapping("/data/grades")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listGrades(
            @RequestParam(value = "programId", required = false) Long programId,
            @RequestParam(value = "studentId", required = false) String studentId) {
        return ResponseEntity.ok(adminInsightsService.listGrades(programId, studentId));
    }

    // Paginated grades endpoint
    @GetMapping("/data/grades/paged")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<Map<String, Object>> listGradesPaged(
            @RequestParam(value = "programId", required = false) Long programId,
            @RequestParam(value = "studentId", required = false) String studentId,
            @RequestParam(value = "category", required = false) String category,
            @RequestParam(value = "page", defaultValue = "0") int page,
            @RequestParam(value = "size", defaultValue = "25") int size) {
        return ResponseEntity.ok(adminInsightsService.listGradesPaged(programId, studentId, category, page, size));
    }

    @GetMapping("/data/progress")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listProgress(
            @RequestParam(value = "programId", required = false) Long programId,
            @RequestParam(value = "studentId", required = false) String studentId) {
        return ResponseEntity.ok(adminInsightsService.listProgress(programId, studentId));
    }

    // Courses in a category
    @GetMapping("/data/courses/by-category")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listCoursesByCategory(
            @RequestParam(value = "programId", required = false) Long programId,
            @RequestParam(value = "categoryName") String categoryName) {
        return ResponseEntity.ok(adminInsightsService.listCoursesByCategory(programId, categoryName));
    }

    // Students who completed a course (promotion == 'P')
    @GetMapping("/data/courses/{courseCode}/completers")
    @PreAuthorize("hasAnyRole('ADMIN','SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listCourseCompleters(
            @PathVariable("courseCode") String courseCode,
            @RequestParam(value = "programId", required = false) Long programId) {
        return ResponseEntity.ok(adminInsightsService.listCourseCompleters(programId, courseCode));
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
