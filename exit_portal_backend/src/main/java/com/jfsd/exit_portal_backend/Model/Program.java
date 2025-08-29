package com.jfsd.exit_portal_backend.Model;

import jakarta.persistence.*;

@Entity
@Table(name = "programs")
public class Program {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    @Column(name = "program_id")
    private Long programId;

    @Column(name = "code", nullable = false, unique = true, length = 20)
    private String code;

    @Column(name = "name", nullable = false, length = 100)
    private String name;

    // Default constructor
    public Program() {}

    // Parameterized constructor
    public Program(String code, String name) {
        this.code = code;
        this.name = name;
    }

    // Getters and Setters
    public Long getProgramId() {
        return programId;
    }

    public void setProgramId(Long programId) {
        this.programId = programId;
    }

    public String getCode() {
        return code;
    }

    public void setCode(String code) {
        this.code = code;
    }

    public String getName() {
        return name;
    }

    public void setName(String name) {
        this.name = name;
    }

    @Override
    public String toString() {
        return "Program{" +
                "programId=" + programId +
                ", code='" + code + '\'' +
                ", name='" + name + '\'' +
                '}';
    }
}
