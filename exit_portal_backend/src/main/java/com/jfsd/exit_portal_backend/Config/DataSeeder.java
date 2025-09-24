package com.jfsd.exit_portal_backend.Config;

import com.jfsd.exit_portal_backend.Model.AdminUser;
import com.jfsd.exit_portal_backend.Repository.AdminUserRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private AdminUserRepository adminUserRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Seed super admin if not exists
        if (!adminUserRepository.existsByUsername("nikilesh")) {
            AdminUser superAdmin = new AdminUser();
            superAdmin.setUsername("nikilesh");
            superAdmin.setName("Nikilesh Reddy T");
            superAdmin.setPassword(passwordEncoder.encode("Nikilesh"));
            superAdmin.setRole(AdminUser.Role.SUPER_ADMIN);
            superAdmin.setProgram(null); // Super admin not tied to any program
            superAdmin.setEnabled(true);
            
            adminUserRepository.save(superAdmin);
            System.out.println("Super admin 'nikilesh' created successfully!");
        } else {
            System.out.println("Super admin 'nikilesh' already exists.");
        }
    }
}
