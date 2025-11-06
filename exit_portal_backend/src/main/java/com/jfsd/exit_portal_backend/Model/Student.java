package com.jfsd.exit_portal_backend.Model;

import jakarta.persistence.*;

@Entity
@Table(
    name = "students",
    indexes = {
        @Index(name = "idx_students_program", columnList = "program_id"),
        @Index(name = "idx_students_name", columnList = "student_name"),
        @Index(name = "idx_students_program_name", columnList = "program_id, student_name")
    }
)
public class Student {

    @Id
    @Column(name = "student_id", nullable = false, length = 64)
    private String studentId;

    @Column(name = "student_name")
    private String studentName;

    @Column(name = "password", nullable = false)
    private String password;

    @ManyToOne
    @JoinColumn(name = "program_id", nullable = true)
    private Program program;

    @Column(name = "has_any_failure", nullable = false)
    private boolean hasAnyFailure = false;

    public Student() {}

    public Student(String studentId, String studentName, String password) {
        this.studentId = studentId;
        this.studentName = studentName;
        this.password = password;
    }

    public String getStudentId() {
        return studentId;
    }

    public void setStudentId(String studentId) {
        this.studentId = studentId;
    }

    public String getStudentName() {
        return studentName;
    }

    public void setStudentName(String studentName) {
        this.studentName = studentName;
    }

    public String getPassword() {
        return password;
    }

    public void setPassword(String password) {
        this.password = password;
    }

    public Program getProgram() {
        return program;
    }

    public void setProgram(Program program) {
        this.program = program;
    }

    public boolean isHasAnyFailure() {
        return hasAnyFailure;
    }

    public void setHasAnyFailure(boolean hasAnyFailure) {
        this.hasAnyFailure = hasAnyFailure;
    }
}
