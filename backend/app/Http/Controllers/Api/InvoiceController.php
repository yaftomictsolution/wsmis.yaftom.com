<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Invoice;
use Illuminate\Http\JsonResponse;

class InvoiceController extends Controller
{
    public function index(): JsonResponse
    {
        return response()->json([
            'data' => Invoice::with([
                'billingPeriod:id,name,code',
                'customer:id,name,phone,house_number',
                'contract:id,contract_number,status',
                'meterReading:id,current_reading,previous_reading,consumption',
                'items.category:id,name,code,type',
                'inventoryRequest:id,invoice_id,document_number',
            ])->latest()->get(),
        ]);
    }

    public function show(Invoice $invoice): JsonResponse
    {
        return response()->json([
            'data' => $invoice->load([
                'billingPeriod',
                'customer.serviceArea',
                'contract:id,contract_number,status,net_amount,remaining_amount',
                'meterReading.meter',
                'items.category:id,name,code,type',
                'items.charge:id,title,type,amount,paid_amount,remaining_amount,status',
                'payments.paymentMethod',
                'payments.receiver:id,name',
                'payments.account:id,name,code,type',
                'inventoryRequest:id,invoice_id,document_number',
            ]),
        ]);
    }
}
