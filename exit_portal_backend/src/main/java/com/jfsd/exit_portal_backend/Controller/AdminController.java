package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Service.AdminService;

import java.util.List;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.*;
import com.jfsd.exit_portal_backend.dto.Admin;

@RestController
@RequestMapping("/admin")
public class AdminController {

    @Autowired
    private AdminService adminService;

    @GetMapping("/consolidation/{universityId}")
    public Admin getAdminConsolidationByUniversityId(@PathVariable String universityId) {
        return adminService.getAdminConsolidationByUniversityId(universityId);
    }

    @GetMapping("/consolidation/getall")
    public List<Admin> getAllAdminConsolidation() {
        return adminService.getAllAdminConsolidation();
    }
    
}
