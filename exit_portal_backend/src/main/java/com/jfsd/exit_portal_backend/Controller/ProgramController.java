package com.jfsd.exit_portal_backend.Controller;

import com.jfsd.exit_portal_backend.Model.Program;
import com.jfsd.exit_portal_backend.Repository.ProgramRepository;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.web.bind.annotation.CrossOrigin;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;

@RestController
@RequestMapping("/api/programs")
@CrossOrigin(origins = {"http://127.0.0.1:5500", "http://localhost:5500", "http://localhost:5173"})
public class ProgramController {

    @Autowired
    private ProgramRepository programRepository;

    @GetMapping
    public List<Program> listPrograms() {
        return programRepository.findAll();
    }
}
