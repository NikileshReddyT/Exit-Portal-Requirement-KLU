package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.AdminUser;
import com.jfsd.exit_portal_backend.Model.Program;
import com.jfsd.exit_portal_backend.Repository.AdminUserRepository;
import com.jfsd.exit_portal_backend.Repository.ProgramRepository;
import com.jfsd.exit_portal_backend.RequestBodies.InvalidPasswordException;
import com.jfsd.exit_portal_backend.RequestBodies.UserNotFoundException;
import com.jfsd.exit_portal_backend.RequestBodies.UpdateAdminRequest;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;

@Service
public class AdminUserService {
    
    @Autowired
    private AdminUserRepository adminUserRepository;
    
    @Autowired
    private PasswordEncoder passwordEncoder;

    @Autowired
    private ProgramRepository programRepository;
    
    public AdminUser authenticateAdmin(String username, String password) {
        AdminUser adminUser = adminUserRepository.findByUsername(username)
                .orElseThrow(() -> new UserNotFoundException("Admin user not found."));
        
        if (!adminUser.getEnabled()) {
            throw new InvalidPasswordException("Admin account is disabled.");
        }
        
        if (!passwordEncoder.matches(password, adminUser.getPassword())) {
            throw new InvalidPasswordException("Incorrect password.");
        }
        
        return adminUser;
    }
    
    public AdminUser createAdmin(String username, String name, String password, AdminUser.Role role, com.jfsd.exit_portal_backend.Model.Program program) {
        if (adminUserRepository.existsByUsername(username)) {
            throw new IllegalArgumentException("Username already exists.");
        }
        
        AdminUser adminUser = new AdminUser();
        adminUser.setUsername(username);
        adminUser.setName(name);
        adminUser.setPassword(passwordEncoder.encode(password));
        adminUser.setRole(role);
        adminUser.setProgram(program);
        adminUser.setEnabled(true);
        
        return adminUserRepository.save(adminUser);
    }

    public AdminUser updateAdmin(Long id, UpdateAdminRequest req) {
        AdminUser existing = adminUserRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("Admin user not found."));

        // Handle role change with last-super-admin protection
        if (req.getRole() != null && !req.getRole().isBlank()) {
            AdminUser.Role newRole;
            try {
                newRole = AdminUser.Role.valueOf(req.getRole().toUpperCase());
            } catch (IllegalArgumentException ex) {
                throw new IllegalArgumentException("invalid role");
            }
            if (existing.getRole() == AdminUser.Role.SUPER_ADMIN && newRole == AdminUser.Role.ADMIN) {
                long superAdmins = adminUserRepository.countByRole(AdminUser.Role.SUPER_ADMIN);
                if (superAdmins <= 1) {
                    throw new IllegalStateException("cannot demote the last SUPER_ADMIN");
                }
            }
            existing.setRole(newRole);
        }

        // Program assignment constraints
        if (existing.getRole() == AdminUser.Role.ADMIN) {
            if (req.getProgramId() == null) {
                throw new IllegalArgumentException("programId is required for ADMIN role");
            }
            Program p = programRepository.findById(req.getProgramId())
                    .orElseThrow(() -> new IllegalArgumentException("program not found"));
            existing.setProgram(p);
        } else if (req.getProgramId() != null) {
            Program p = programRepository.findById(req.getProgramId())
                    .orElseThrow(() -> new IllegalArgumentException("program not found"));
            existing.setProgram(p);
        }

        if (req.getName() != null && !req.getName().isBlank()) {
            existing.setName(req.getName());
        }
        if (req.getPassword() != null && !req.getPassword().isBlank()) {
            existing.setPassword(passwordEncoder.encode(req.getPassword()));
        }
        if (req.getEnabled() != null) {
            if (existing.getRole() == AdminUser.Role.SUPER_ADMIN && !req.getEnabled()) {
                long superAdmins = adminUserRepository.countByRole(AdminUser.Role.SUPER_ADMIN);
                if (superAdmins <= 1) {
                    throw new IllegalStateException("cannot disable the last SUPER_ADMIN");
                }
            }
            existing.setEnabled(req.getEnabled());
        }

        return adminUserRepository.save(existing);
    }

    public void deleteAdmin(Long id) {
        AdminUser existing = adminUserRepository.findById(id)
                .orElseThrow(() -> new UserNotFoundException("Admin user not found."));
        if (existing.getRole() == AdminUser.Role.SUPER_ADMIN) {
            long superAdmins = adminUserRepository.countByRole(AdminUser.Role.SUPER_ADMIN);
            if (superAdmins <= 1) {
                throw new IllegalStateException("cannot delete the last SUPER_ADMIN");
            }
        }
        adminUserRepository.delete(existing);
    }
}
