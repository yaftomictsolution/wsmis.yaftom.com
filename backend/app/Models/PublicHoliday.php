<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;

class PublicHoliday extends Model
{
    use HasFactory;

    protected $fillable = ['holiday_date', 'name', 'is_paid', 'status', 'notes'];

    protected function casts(): array
    {
        return ['holiday_date' => 'date', 'is_paid' => 'boolean'];
    }
}
