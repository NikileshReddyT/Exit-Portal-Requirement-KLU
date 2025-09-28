package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Model.AdminUser;
import com.jfsd.exit_portal_backend.Model.Program;
import com.jfsd.exit_portal_backend.Repository.AdminUserRepository;
import com.jfsd.exit_portal_backend.Repository.ProgramRepository;
import com.jfsd.exit_portal_backend.dto.CreateAdminRequest;
import com.jfsd.exit_portal_backend.dto.UpdateAdminRequest;
import com.jfsd.exit_portal_backend.Service.AdminUserService;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/admin-users")
public class AdminManagementController {

    @Autowired
    private AdminUserRepository adminUserRepository;

    @Autowired
    private AdminUserService adminUserService;

    @Autowired
    private ProgramRepository programRepository;

    // SUPER_ADMIN: list all admin users (optionally filtered by program)
    @GetMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<List<Map<String, Object>>> listAdmins(@RequestParam(value = "programId", required = false) Long programId) {
        List<AdminUser> admins;
        if (programId != null) {
            // Filter by program BUT always include SUPER_ADMINs (regardless of program)
            admins = adminUserRepository.findAll().stream()
                    .filter(admin ->
                            admin.getRole() == AdminUser.Role.SUPER_ADMIN ||
                            (admin.getProgram() != null && admin.getProgram().getProgramId().equals(programId))
                    )
                    .collect(Collectors.toList());
        } else {
            // Return all admin users
            admins = adminUserRepository.findAll();
        }
        
        List<Map<String, Object>> items = admins.stream()
                .map(this::toDTO)
                .collect(Collectors.toList());
        return ResponseEntity.ok(items);
    }

    // SUPER_ADMIN: create a new admin user
    @PostMapping
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> createAdmin(@RequestBody CreateAdminRequest req) {
        if (req.getUsername() == null || req.getUsername().isBlank()) {
            return ResponseEntity.badRequest().body("username is required");
        }
        if (req.getName() == null || req.getName().isBlank()) {
            return ResponseEntity.badRequest().body("name is required");
        }
        if (req.getPassword() == null || req.getPassword().isBlank()) {
            return ResponseEntity.badRequest().body("password is required");
        }
        if (req.getRole() == null || req.getRole().isBlank()) {
            return ResponseEntity.badRequest().body("role is required");
        }

        AdminUser.Role role;
        try {
            role = AdminUser.Role.valueOf(req.getRole().toUpperCase());
        } catch (IllegalArgumentException ex) {
            return ResponseEntity.badRequest().body("invalid role");
        }

        Program program = null;
        if (role == AdminUser.Role.ADMIN) {
            if (req.getProgramId() == null) {
                return ResponseEntity.badRequest().body("programId is required for ADMIN role");
            }
            Optional<Program> p = programRepository.findById(req.getProgramId());
            if (p.isEmpty()) {
                return ResponseEntity.badRequest().body("program not found");
            }
            program = p.get();
        } else if (req.getProgramId() != null) {
            // SUPER_ADMIN can optionally be associated with a program
            Optional<Program> p = programRepository.findById(req.getProgramId());
            if (p.isEmpty()) {
                return ResponseEntity.badRequest().body("program not found");
            }
            program = p.get();
        }

        AdminUser created = adminUserService.createAdmin(
                req.getUsername(),
                req.getName(),
                req.getPassword(),
                role,
                program
        );
        return ResponseEntity.ok(toDTO(created));
    }

    // SUPER_ADMIN: update existing admin user
    @PutMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> updateAdmin(@PathVariable Long id, @RequestBody UpdateAdminRequest req) {
        try {
            AdminUser updated = adminUserService.updateAdmin(id, req);
            return ResponseEntity.ok(toDTO(updated));
        } catch (IllegalArgumentException | IllegalStateException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    // SUPER_ADMIN: delete admin user
    @DeleteMapping("/{id}")
    @PreAuthorize("hasRole('SUPER_ADMIN')")
    public ResponseEntity<?> deleteAdmin(@PathVariable Long id) {
        try {
            adminUserService.deleteAdmin(id);
            return ResponseEntity.noContent().build();
        } catch (IllegalStateException ex) {
            return ResponseEntity.badRequest().body(ex.getMessage());
        }
    }

    private Map<String, Object> toDTO(AdminUser u) {
        Map<String, Object> m = new LinkedHashMap<>();
        m.put("id", u.getId());
        m.put("username", u.getUsername());
        m.put("name", u.getName());
        m.put("role", u.getRole().name());
        m.put("enabled", u.getEnabled());
        m.put("createdAt", u.getCreatedAt());
        if (u.getProgram() != null) {
            Map<String, Object> pm = new LinkedHashMap<>();
            pm.put("programId", u.getProgram().getProgramId());
            pm.put("code", u.getProgram().getCode());
            pm.put("name", u.getProgram().getName());
            m.put("program", pm);
        } else {
            m.put("program", null);
        }
        return m;
    }
}
