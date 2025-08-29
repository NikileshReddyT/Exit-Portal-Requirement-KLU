package com.jfsd.exit_portal_backend.Model;

import java.util.Objects;
import jakarta.persistence.*;

@Entity
@Table(name = "courses")
public class Courses {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private int courseID;

    @Column(name = "course_code", nullable = false, unique = true)
    private String courseCode;

    @Column(name = "course_title", nullable = false)
    private String courseTitle;

    @Column(name = "course_credits", nullable = false)
    private double courseCredits;

    // Getters and Setters

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (o == null || getClass() != o.getClass()) return false;
        Courses courses = (Courses) o;
        return courseID == courses.courseID;
    }

    @Override
    public int hashCode() {
        return Objects.hash(courseID);
    }

    public int getCourseID() {
        return courseID;
    }

    public void setCourseID(int courseID) {
        this.courseID = courseID;
    }

    public String getCourseCode() {
        return courseCode;
    }

    public void setCourseCode(String courseCode) {
        this.courseCode = courseCode;
    }

    public String getCourseTitle() {
        return courseTitle;
    }

    public void setCourseTitle(String courseTitle) {
        this.courseTitle = courseTitle;
    }

    public double getCourseCredits() {
        return courseCredits;
    }

    public void setCourseCredits(double courseCredits) {
        this.courseCredits = courseCredits;
    }

}
