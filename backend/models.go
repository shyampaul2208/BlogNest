package main

import (
	"time"
)

type User struct {
	ID        string `json:"id" gorm:"primaryKey"`
	GoogleID  string `json:"google_id" gorm:"index"`
	Email     string `json:"email" gorm:"uniqueIndex"`
	Name      string `json:"name"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Picture   string `json:"picture"`
	Password  string `json:"-"` // Not returned in JSON
	CreatedAt time.Time
	UpdatedAt time.Time
}
