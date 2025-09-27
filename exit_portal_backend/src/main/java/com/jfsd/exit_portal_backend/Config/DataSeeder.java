package com.jfsd.exit_portal_backend.Config;

import com.jfsd.exit_portal_backend.Model.AdminUser;
import com.jfsd.exit_portal_backend.Model.Program;
import com.jfsd.exit_portal_backend.Repository.AdminUserRepository;
import com.jfsd.exit_portal_backend.Repository.ProgramRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.CommandLineRunner;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Component;

@Component
public class DataSeeder implements CommandLineRunner {

    @Autowired
    private AdminUserRepository adminUserRepository;

    @Autowired
    private ProgramRepository programRepository;

    @Autowired
    private PasswordEncoder passwordEncoder;

    @Override
    public void run(String... args) throws Exception {
        // Seed programs if not exist
        seedPrograms();
        
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

    private void seedPrograms() {
        // Define programs to seed
        String[][] programsData = {
            {"BT-CS", "B Tech - CSE"},
            {"BT-AIDS", "B Tech - AIDS"},
            {"BT-EEE", "B Tech - EEE"},
            {"BT-ECE", "B Tech - ECE"},
            {"BT-MECH", "B Tech - MECH"},
            {"BT-CIVIL", "B Tech - CIVIL"}
        };
        int createdCount = 0;
        
        for (String[] programData : programsData) {
            String code = programData[0];
            String name = programData[1];
            
            if (!programRepository.existsByCode(code)) {
                Program program = new Program(code, name);
                programRepository.save(program);
                createdCount++;
            } 
        }
        
        if (createdCount > 0) {
            System.out.println("Total " + createdCount + " new programs created.");
        } else {
            System.out.println("All programs already exist, no new programs created.");
        }
    }
}
