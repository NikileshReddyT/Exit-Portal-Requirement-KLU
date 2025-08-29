package com.jfsd.exit_portal_backend.Service;

import com.jfsd.exit_portal_backend.Model.StudentCategoryProgress;
import com.jfsd.exit_portal_backend.Model.Student;
import com.jfsd.exit_portal_backend.Repository.StudentCategoryProgressRepository;
import com.jfsd.exit_portal_backend.Repository.StudentRepository;
import com.jfsd.exit_portal_backend.RequestBodies.Admin;

import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.stereotype.Service;

import java.util.*;

@Service
public class AdminService {

    @Autowired
    private StudentCategoryProgressRepository studentCategoryProgressRepository;

    @Autowired
    private StudentRepository studentRepository;

    public List<Admin> getAllAdminConsolidation(){
        List<Student> students = studentRepository.findAll();
        List<Admin> adminConsolidation = new ArrayList<>();
        for (Student s : students) {
            Admin a = getAdminConsolidationByUniversityId(s.getStudentId());
            adminConsolidation.add(a);
        }
        return adminConsolidation;
    }






    public Admin getAdminConsolidationByUniversityId(String universityId) {
        List<StudentCategoryProgress> studentProgressList = studentCategoryProgressRepository.findByUniversityId(universityId);

        List<Map<String, Integer>> consolidationList = new ArrayList<>();
        
        for (StudentCategoryProgress progress : studentProgressList) {
            Map<String, Integer> categoryMap = new HashMap<>();
            categoryMap.put(progress.getCategoryName(), progress.getCompletedCourses());
            consolidationList.add(categoryMap);
        }

        Admin admin = new Admin();
        admin.setUniversityId(universityId);
        admin.setAdminConsolidation(consolidationList);

        return admin;
    }
}
