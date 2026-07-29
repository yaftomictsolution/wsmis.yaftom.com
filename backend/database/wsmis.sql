-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Host: 127.0.0.1
-- Generation Time: Jul 29, 2026 at 07:07 AM
-- Server version: 10.4.32-MariaDB
-- PHP Version: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Database: `wsmis`
--

-- --------------------------------------------------------

--
-- Table structure for table `accounting_accounts`
--

CREATE TABLE `accounting_accounts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL DEFAULT 'cash',
  `opening_balance` decimal(16,2) NOT NULL DEFAULT 0.00,
  `current_balance` decimal(16,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `accounting_accounts`
--

INSERT INTO `accounting_accounts` (`id`, `name`, `code`, `type`, `opening_balance`, `current_balance`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'Main Cash Account', 'cash_on_hand', 'cash', 500000.00, 428180.00, 'active', 'Counter collections and daily cash expenses.', '2026-07-28 05:26:03', '2026-07-28 05:26:28'),
(2, 'Operating Bank Account', 'bank_account', 'bank', 1500000.00, 2259050.00, 'active', 'Primary bank account for payroll and major purchases.', '2026-07-28 05:26:03', '2026-07-28 05:26:30'),
(3, 'Mobile Money Account', 'mobile_money_account', 'mobile_money', 0.00, 0.00, 'active', NULL, '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(4, 'Check Clearing Account', 'check_clearing_account', 'check', 0.00, 0.00, 'active', NULL, '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(5, 'Online Payment Account', 'online_payment_account', 'online', 0.00, 0.00, 'active', NULL, '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(6, 'Mobile Money Wallet', 'mobile_wallet', 'mobile_money', 100000.00, 76000.00, 'active', 'Mobile-money customer collections.', '2026-07-28 05:26:21', '2026-07-28 05:26:28'),
(7, 'TEST Cash on Hand', 'test_cash_on_hand', 'cash', 10000.00, 11950.00, 'active', 'Account used by invoice-first demo records.', '2026-07-28 05:26:23', '2026-07-28 05:26:24'),
(8, 'TEST Bank Account', 'test_bank_account', 'bank', 25000.00, 27270.00, 'active', 'Account used by invoice-first demo records.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(9, 'Payroll Bank', 'payroll_bank', 'bank', 300000.00, 125603.31, 'active', 'Dedicated Phase 6 payroll and settlement demonstration account.', '2026-07-28 05:26:26', '2026-07-28 05:26:28'),
(10, 'Office Account', 'H#0000', 'cash', 0.00, 130400.00, 'active', 'this is some description', '2026-07-28 06:07:02', '2026-07-28 07:10:33');

-- --------------------------------------------------------

--
-- Table structure for table `accounting_transactions`
--

CREATE TABLE `accounting_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `financial_category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_method_id` bigint(20) UNSIGNED DEFAULT NULL,
  `accounting_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_id` bigint(20) UNSIGNED DEFAULT NULL,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `supplier_installment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `recorded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `transaction_number` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `received_from` varchar(255) DEFAULT NULL,
  `paid_to` varchar(255) DEFAULT NULL,
  `transaction_date` date NOT NULL,
  `receipt_number` varchar(255) DEFAULT NULL,
  `reference` varchar(255) DEFAULT NULL,
  `source_type` varchar(255) DEFAULT NULL,
  `source_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending_review',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `posted_at` timestamp NULL DEFAULT NULL,
  `reversed_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `reversal_reason` text DEFAULT NULL,
  `attachment_path` varchar(255) DEFAULT NULL,
  `attachment_original_name` varchar(255) DEFAULT NULL,
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `accounting_transactions`
--

INSERT INTO `accounting_transactions` (`id`, `financial_category_id`, `payment_method_id`, `accounting_account_id`, `customer_id`, `supplier_id`, `supplier_installment_id`, `recorded_by`, `reviewed_by`, `approved_by`, `rejected_by`, `transaction_number`, `type`, `title`, `amount`, `received_from`, `paid_to`, `transaction_date`, `receipt_number`, `reference`, `source_type`, `source_id`, `status`, `reviewed_at`, `approved_at`, `rejected_at`, `posted_at`, `reversed_at`, `rejection_reason`, `reversal_reason`, `attachment_path`, `attachment_original_name`, `description`, `created_at`, `updated_at`) VALUES
(1, 38, 1, 7, 1, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00001', 'income', 'INV-C-20260728-00001 payment', 800.00, 'TEST Ahmad', NULL, '2026-07-18', 'RCT-20260728-00001', 'TEST-PAY-0001', 'customer_payment_allocation', 1, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'One receipt allocated across contract, water, and service invoices.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 1, 1, 7, 1, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00002', 'income', 'INV-W-20260728-00002 payment', 500.00, 'TEST Ahmad', NULL, '2026-07-18', 'RCT-20260728-00001', 'TEST-PAY-0001', 'customer_payment_allocation', 2, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'One receipt allocated across contract, water, and service invoices.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 43, 1, 7, 1, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00003', 'income', 'INV-S-20260728-00003 payment', 150.00, 'TEST Ahmad', NULL, '2026-07-18', 'RCT-20260728-00001', 'TEST-PAY-0001', 'customer_payment_allocation', 3, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'One receipt allocated across contract, water, and service invoices.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(4, 38, 2, 8, 2, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00004', 'income', 'INV-C-20260728-00004 payment', 100.00, 'TEST Laila', NULL, '2026-07-18', 'RCT-20260728-00002', 'TEST-CANCEL-0001', 'customer_payment_allocation', 4, 'cancelled', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(5, 38, 2, 8, 2, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00005', 'income', 'INV-C-20260728-00004 payment', 800.00, 'TEST Laila', NULL, '2026-07-18', 'RCT-20260728-00003', 'TEST-PAY-0002', 'customer_payment_allocation', 5, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'Full payment across all outstanding invoice types.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(6, 42, 2, 8, 2, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00006', 'income', 'INV-C-20260728-00004 payment', 400.00, 'TEST Laila', NULL, '2026-07-18', 'RCT-20260728-00003', 'TEST-PAY-0002', 'customer_payment_allocation', 5, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'Full payment across all outstanding invoice types.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(7, 1, 2, 8, 2, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00007', 'income', 'INV-W-20260728-00005 payment', 520.00, 'TEST Laila', NULL, '2026-07-18', 'RCT-20260728-00003', 'TEST-PAY-0002', 'customer_payment_allocation', 6, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'Full payment across all outstanding invoice types.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(8, 43, 2, 8, 2, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00008', 'income', 'INV-S-20260728-00006 payment', 250.00, 'TEST Laila', NULL, '2026-07-18', 'RCT-20260728-00003', 'TEST-PAY-0002', 'customer_payment_allocation', 7, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'Full payment across all outstanding invoice types.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(9, 43, 2, 8, 2, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00009', 'income', 'INV-S-20260728-00007 payment', 100.00, 'TEST Laila', NULL, '2026-07-18', 'RCT-20260728-00003', 'TEST-PAY-0002', 'customer_payment_allocation', 8, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'Full payment across all outstanding invoice types.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(10, 43, 2, 8, 2, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00010', 'income', 'INV-S-20260728-00008 payment', 200.00, 'TEST Laila', NULL, '2026-07-18', 'RCT-20260728-00003', 'TEST-PAY-0002', 'customer_payment_allocation', 9, 'approved', '2026-07-28 05:26:23', '2026-07-28 05:26:23', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'Full payment across all outstanding invoice types.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(11, 38, 1, 7, 3, NULL, NULL, 7, 7, 7, NULL, 'INC-20260728-00011', 'income', 'INV-C-20260728-00009 payment', 500.00, 'TEST Mariam', NULL, '2026-07-18', 'RCT-20260728-00004', 'TEST-PAY-0003', 'customer_payment_allocation', 10, 'approved', '2026-07-28 05:26:24', '2026-07-28 05:26:24', NULL, '2026-07-28 05:26:24', NULL, NULL, NULL, NULL, NULL, 'Partial contract payment leaves all other invoices outstanding.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(12, 12, 2, 9, NULL, NULL, NULL, 4, 2, 1, NULL, 'EXP-20260728-00012', 'expense', 'June 2026 Payroll', 117146.69, NULL, 'Employees', '2026-06-30', NULL, 'PAY-20260728-00001', 'payroll_run', 1, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Approved demo payroll generated from attendance, leave, overtime, bonuses, tax, and recurring deductions.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(13, 44, 2, 9, NULL, NULL, NULL, 4, 2, 1, NULL, 'EAD-20260728-00013', 'expense', 'Salary advance - Farid Safi', 3000.00, NULL, 'Farid Safi', '2026-07-01', NULL, 'ADV-DEMO-00001', 'salary_advance', 1, 'approved', '2026-07-01 04:45:00', '2026-07-01 05:00:00', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Emergency salary advance before employee resignation.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(14, 45, 2, 9, NULL, NULL, NULL, 4, 2, 1, NULL, 'EXP-20260728-00014', 'expense', 'Final settlement - Farid Safi', 32300.00, NULL, 'Farid Safi', '2026-07-15', NULL, 'SET-DEMO-00001', 'employee_termination', 1, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Employee resignation after notice period.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(15, 46, NULL, 1, NULL, 1, NULL, 1, 1, 1, NULL, 'EXP-20260728-00015', 'expense', 'Inventory Purchase - PO-20260728-00001', 1000.00, NULL, 'Kabul Pipe Supplies', '2026-07-28', NULL, NULL, 'inventory_request', 1, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'DEMO-INVENTORY:PURCHASE-PIPE', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(16, 46, NULL, 2, NULL, 2, NULL, 1, 1, 1, NULL, 'EXP-20260728-00016', 'expense', 'Inventory Purchase - PO-20260728-00002', 1200.00, NULL, 'Afghan Meter Company', '2026-07-28', NULL, NULL, 'inventory_request', 2, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'DEMO-INVENTORY:PURCHASE-METER', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(17, 47, NULL, NULL, NULL, NULL, NULL, 1, 1, 1, NULL, 'EXP-20260728-00017', 'expense', 'Internal Material Usage - SI-20260728-00003', 100.00, NULL, NULL, '2026-07-28', NULL, NULL, 'inventory_request', 3, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'DEMO-INVENTORY:INTERNAL-ISSUE', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(18, 48, 1, 1, 1, NULL, NULL, 1, 1, 1, NULL, 'INC-20260728-00018', 'income', 'INV-I-20260728-00012 payment', 600.00, 'TEST Ahmad', NULL, '2026-07-28', 'RCT-20260728-00005', 'SI-20260728-00004', 'customer_payment_allocation', 11, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'DEMO-INVENTORY:CUSTOMER-ISSUE', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(19, 49, NULL, NULL, 1, NULL, NULL, 1, 1, 1, NULL, 'EXP-20260728-00019', 'expense', 'Cost of Goods Sold - SI-20260728-00004', 400.00, NULL, NULL, '2026-07-28', NULL, NULL, 'inventory_request_cogs', 4, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Inventory cost recognized for SI-20260728-00004', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(20, 7, 2, 2, NULL, NULL, NULL, 3, 2, 1, NULL, 'INC-20260728-00020', 'income', 'April network service income', 300000.00, 'Water network operations', NULL, '2026-04-20', 'DEMO-INC-001', 'FULL-DEMO-INCOME-1', 'manual', NULL, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Approved income used to verify monthly reports and shareholder profit.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(21, 7, 2, 2, NULL, NULL, NULL, 3, 2, 1, NULL, 'INC-20260728-00021', 'income', 'May network service income', 320000.00, 'Water network operations', NULL, '2026-05-20', 'DEMO-INC-002', 'FULL-DEMO-INCOME-2', 'manual', NULL, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Approved income used to verify monthly reports and shareholder profit.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(22, 7, 2, 2, NULL, NULL, NULL, 3, 2, 1, NULL, 'INC-20260728-00022', 'income', 'June network service income', 450000.00, 'Water network operations', NULL, '2026-06-20', 'DEMO-INC-003', 'FULL-DEMO-INCOME-3', 'manual', NULL, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Approved income used to verify monthly reports and shareholder profit.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(23, 13, 1, 1, NULL, NULL, NULL, 3, 2, 1, NULL, 'EXP-20260728-00023', 'expense', 'April office rent', 10000.00, NULL, 'Kabul Property Services', '2026-04-25', 'DEMO-EXP-001', 'FULL-DEMO-EXPENSE-1', 'manual', NULL, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Approved operating expense used by the dynamic reports.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(24, 16, 1, 1, NULL, NULL, NULL, 3, 2, 1, NULL, 'EXP-20260728-00024', 'expense', 'May generator fuel', 8000.00, NULL, 'Kabul Fuel Station', '2026-05-25', 'DEMO-EXP-002', 'FULL-DEMO-EXPENSE-2', 'manual', NULL, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Approved operating expense used by the dynamic reports.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(25, 40, 1, 1, NULL, NULL, NULL, 3, 2, 1, NULL, 'EXP-20260728-00025', 'expense', 'June electricity bill', 7000.00, NULL, 'Electricity Utility', '2026-06-25', 'DEMO-EXP-003', 'FULL-DEMO-EXPENSE-3', 'manual', NULL, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', NULL, NULL, NULL, NULL, NULL, 'Approved operating expense used by the dynamic reports.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(26, 12, 2, 9, NULL, NULL, NULL, 3, 2, 1, NULL, 'EXP-20260728-00026', 'expense', 'April 2026 Demo Payroll', 10250.00, NULL, 'Employees', '2026-04-30', NULL, 'PAY-20260728-00002', 'payroll_run', 2, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, NULL, 'Approved historical payroll for full-system report coverage.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(27, 12, 2, 9, NULL, NULL, NULL, 3, 2, 1, NULL, 'EXP-20260728-00027', 'expense', 'May 2026 Demo Payroll', 11700.00, NULL, 'Employees', '2026-05-31', NULL, 'PAY-20260728-00003', 'payroll_run', 3, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, NULL, 'Approved historical payroll for full-system report coverage.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(28, 46, NULL, 1, NULL, 3, NULL, 1, 1, 1, NULL, 'EXP-20260728-00028', 'expense', 'Inventory Purchase - PO-20260728-00005', 1500.00, NULL, 'Kabul Valve & Fittings', '2026-07-23', NULL, NULL, 'inventory_request', 5, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, NULL, 'FULL-DEMO:PURCHASE-VALVES', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(29, 48, 1, 1, 3, NULL, NULL, 8, 1, 1, NULL, 'INC-20260728-00029', 'income', 'INV-I-20260728-00013 payment', 80.00, 'TEST Mariam', NULL, '2026-07-24', 'RCT-20260728-00006', 'SI-20260728-00006', 'customer_payment_allocation', 12, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, NULL, 'FULL-DEMO:PARTIAL-CUSTOMER-ISSUE', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(30, 49, NULL, NULL, 3, NULL, NULL, 1, 1, 1, NULL, 'EXP-20260728-00030', 'expense', 'Cost of Goods Sold - SI-20260728-00006', 120.00, NULL, NULL, '2026-07-24', NULL, NULL, 'inventory_request_cogs', 6, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, NULL, 'Inventory cost recognized for SI-20260728-00006', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(31, 37, 2, 2, NULL, 1, NULL, 3, 2, 1, NULL, 'EXP-20260728-00031', 'expense', 'Asset Purchase - ASP-20260728-00001', 30000.00, NULL, 'Kabul Pipe Supplies', '2026-07-22', 'DEMO-ASSET-INVOICE-1', 'ASP-20260728-00001', 'asset_purchase', 1, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, NULL, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(32, 37, 1, 1, NULL, 2, NULL, 3, 2, 1, NULL, 'EXP-20260728-00032', 'expense', 'Asset Purchase - ASP-20260728-00002', 45000.00, NULL, 'Afghan Meter Company', '2026-07-23', 'DEMO-ASSET-INVOICE-2', 'ASP-20260728-00002', 'asset_purchase', 2, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, NULL, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(33, 37, 3, 6, NULL, 3, NULL, 3, 2, 1, NULL, 'EXP-20260728-00033', 'expense', 'Asset Purchase - ASP-20260728-00003', 24000.00, NULL, 'Kabul Valve & Fittings', '2026-07-24', 'DEMO-ASSET-INVOICE-3', 'ASP-20260728-00003', 'asset_purchase', 3, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, NULL, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(34, 36, 2, 2, NULL, NULL, NULL, 3, 2, 1, NULL, 'EQT-20260728-00034', 'equity', 'Shareholder distribution - DST-20260728-00001', 139875.00, NULL, 'Abdul Rahman Safi', '2026-07-25', 'DEMO-SH-PAY-1', 'SHP-20260728-00001', 'shareholder_payment', 1, 'approved', '2026-07-28 05:26:30', '2026-07-28 05:26:30', NULL, '2026-07-28 05:26:30', NULL, NULL, NULL, NULL, NULL, 'Paid first demo distribution entitlement in full.', '2026-07-28 05:26:30', '2026-07-28 05:26:30'),
(35, 36, 2, 2, NULL, NULL, NULL, 3, 2, 1, NULL, 'EQT-20260728-00035', 'equity', 'Shareholder distribution - DST-20260728-00001', 83925.00, NULL, 'Farida Noori', '2026-07-26', 'DEMO-SH-PAY-2', 'SHP-20260728-00002', 'shareholder_payment', 2, 'approved', '2026-07-28 05:26:30', '2026-07-28 05:26:30', NULL, '2026-07-28 05:26:30', NULL, NULL, NULL, NULL, NULL, 'Paid first demo distribution entitlement in full.', '2026-07-28 05:26:30', '2026-07-28 05:26:30'),
(36, 36, 2, 2, NULL, NULL, NULL, 3, 2, 1, NULL, 'EQT-20260728-00036', 'equity', 'Shareholder distribution - DST-20260728-00001', 55950.00, NULL, 'Hamid Wardak', '2026-07-27', 'DEMO-SH-PAY-3', 'SHP-20260728-00003', 'shareholder_payment', 3, 'approved', '2026-07-28 05:26:30', '2026-07-28 05:26:30', NULL, '2026-07-28 05:26:30', NULL, NULL, NULL, NULL, NULL, 'Paid first demo distribution entitlement in full.', '2026-07-28 05:26:30', '2026-07-28 05:26:30'),
(37, 38, 1, 10, 4, NULL, NULL, 1, 1, 1, NULL, 'INC-20260728-00037', 'income', 'INV-C-20260728-00014 payment', 100.00, 'samim', NULL, '2026-07-28', 'RCT-20260728-00007', NULL, 'customer_payment_allocation', 13, 'approved', '2026-07-28 06:27:08', '2026-07-28 06:27:08', NULL, '2026-07-28 06:27:08', NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-28 06:27:08', '2026-07-28 06:27:08'),
(38, 42, 1, 10, 4, NULL, NULL, 1, 1, 1, NULL, 'INC-20260728-00038', 'income', 'INV-C-20260728-00014 payment', 100.00, 'samim', NULL, '2026-07-28', 'RCT-20260728-00007', NULL, 'customer_payment_allocation', 13, 'approved', '2026-07-28 06:27:08', '2026-07-28 06:27:08', NULL, '2026-07-28 06:27:08', NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-28 06:27:08', '2026-07-28 06:27:08'),
(39, 50, 1, 10, 4, NULL, NULL, 1, 1, 1, NULL, 'RFD-20260728-00039', 'customer_refund', 'Customer payment refund - RCT-20260728-00007', 200.00, NULL, 'samim', '2026-07-28', 'PRF-20260728-00001', '200', 'customer_payment_allocation_refund', 13, 'approved', '2026-07-28 06:30:20', '2026-07-28 06:30:20', NULL, '2026-07-28 06:30:20', NULL, NULL, NULL, NULL, NULL, 'Contract CTR-20260728-00004 cancellation: this is some description', '2026-07-28 06:30:20', '2026-07-28 06:30:20'),
(40, 38, 1, 10, 4, NULL, NULL, 1, 1, 1, NULL, 'INC-20260728-00040', 'income', 'INV-C-20260728-00015 payment', 200.00, 'samim', NULL, '2026-07-28', 'RCT-20260728-00008', NULL, 'customer_payment_allocation', 14, 'approved', '2026-07-28 07:01:28', '2026-07-28 07:01:28', NULL, '2026-07-28 07:01:28', NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-28 07:01:28', '2026-07-28 07:01:28'),
(41, 42, 1, 10, 4, NULL, NULL, 1, 1, 1, NULL, 'INC-20260728-00041', 'income', 'INV-C-20260728-00015 payment', 200.00, 'samim', NULL, '2026-07-28', 'RCT-20260728-00008', NULL, 'customer_payment_allocation', 14, 'approved', '2026-07-28 07:01:28', '2026-07-28 07:01:28', NULL, '2026-07-28 07:01:28', NULL, NULL, NULL, NULL, NULL, NULL, '2026-07-28 07:01:28', '2026-07-28 07:01:28'),
(42, 1, 1, 10, 4, NULL, NULL, 1, 1, 1, NULL, 'INC-20260728-00042', 'income', 'INV-W-20260728-00016 payment', 130000.00, 'samim', NULL, '2026-07-28', 'RCT-20260728-00009', NULL, 'customer_payment_allocation', 15, 'approved', '2026-07-28 07:10:33', '2026-07-28 07:10:33', NULL, '2026-07-28 07:10:33', NULL, NULL, NULL, NULL, NULL, 'sfdfsdfsdf', '2026-07-28 07:10:33', '2026-07-28 07:10:33');

-- --------------------------------------------------------

--
-- Table structure for table `account_reconciliations`
--

CREATE TABLE `account_reconciliations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `accounting_account_id` bigint(20) UNSIGNED NOT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reconciliation_number` varchar(255) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `book_balance` decimal(16,2) NOT NULL,
  `statement_balance` decimal(16,2) NOT NULL,
  `adjusted_statement_balance` decimal(16,2) NOT NULL,
  `difference` decimal(16,2) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'draft',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `account_reconciliations`
--

INSERT INTO `account_reconciliations` (`id`, `accounting_account_id`, `created_by`, `reviewed_by`, `approved_by`, `rejected_by`, `reconciliation_number`, `period_start`, `period_end`, `book_balance`, `statement_balance`, `adjusted_statement_balance`, `difference`, `status`, `submitted_at`, `reviewed_at`, `approved_at`, `rejected_at`, `rejection_reason`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 3, 2, 1, NULL, 'REC-20260728-00001', '2026-04-01', '2026-04-30', 490000.00, 490000.00, 490000.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(2, 2, 3, 2, 1, NULL, 'REC-20260728-00002', '2026-04-01', '2026-04-30', 1800000.00, 1800000.00, 1800000.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(3, 3, 3, 2, 1, NULL, 'REC-20260728-00003', '2026-04-01', '2026-04-30', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(4, 4, 3, 2, 1, NULL, 'REC-20260728-00004', '2026-04-01', '2026-04-30', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(5, 5, 3, 2, 1, NULL, 'REC-20260728-00005', '2026-04-01', '2026-04-30', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(6, 6, 3, 2, 1, NULL, 'REC-20260728-00006', '2026-04-01', '2026-04-30', 100000.00, 100000.00, 100000.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(7, 7, 3, 2, 1, NULL, 'REC-20260728-00007', '2026-04-01', '2026-04-30', 10000.00, 10000.00, 10000.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(8, 8, 3, 2, 1, NULL, 'REC-20260728-00008', '2026-04-01', '2026-04-30', 25000.00, 25000.00, 25000.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(9, 9, 3, 2, 1, NULL, 'REC-20260728-00009', '2026-04-01', '2026-04-30', 289750.00, 289750.00, 289750.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(10, 1, 3, 2, 1, NULL, 'REC-20260728-00010', '2026-05-01', '2026-05-31', 482000.00, 482000.00, 482000.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(11, 2, 3, 2, 1, NULL, 'REC-20260728-00011', '2026-05-01', '2026-05-31', 2120000.00, 2120000.00, 2120000.00, 0.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(12, 3, 3, 2, 1, NULL, 'REC-20260728-00012', '2026-05-01', '2026-05-31', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(13, 4, 3, 2, 1, NULL, 'REC-20260728-00013', '2026-05-01', '2026-05-31', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(14, 5, 3, 2, 1, NULL, 'REC-20260728-00014', '2026-05-01', '2026-05-31', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(15, 6, 3, 2, 1, NULL, 'REC-20260728-00015', '2026-05-01', '2026-05-31', 100000.00, 100000.00, 100000.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(16, 7, 3, 2, 1, NULL, 'REC-20260728-00016', '2026-05-01', '2026-05-31', 10000.00, 10000.00, 10000.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(17, 8, 3, 2, 1, NULL, 'REC-20260728-00017', '2026-05-01', '2026-05-31', 25000.00, 25000.00, 25000.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(18, 9, 3, 2, 1, NULL, 'REC-20260728-00018', '2026-05-01', '2026-05-31', 278050.00, 278050.00, 278050.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(19, 1, 3, 2, 1, NULL, 'REC-20260728-00019', '2026-06-01', '2026-06-30', 475000.00, 475000.00, 475000.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(20, 2, 3, 2, 1, NULL, 'REC-20260728-00020', '2026-06-01', '2026-06-30', 2570000.00, 2570000.00, 2570000.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(21, 3, 3, 2, 1, NULL, 'REC-20260728-00021', '2026-06-01', '2026-06-30', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(22, 4, 3, 2, 1, NULL, 'REC-20260728-00022', '2026-06-01', '2026-06-30', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(23, 5, 3, 2, 1, NULL, 'REC-20260728-00023', '2026-06-01', '2026-06-30', 0.00, 0.00, 0.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(24, 6, 3, 2, 1, NULL, 'REC-20260728-00024', '2026-06-01', '2026-06-30', 100000.00, 100000.00, 100000.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(25, 7, 3, 2, 1, NULL, 'REC-20260728-00025', '2026-06-01', '2026-06-30', 10000.00, 10000.00, 10000.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(26, 8, 3, 2, 1, NULL, 'REC-20260728-00026', '2026-06-01', '2026-06-30', 25000.00, 25000.00, 25000.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(27, 9, 3, 2, 1, NULL, 'REC-20260728-00027', '2026-06-01', '2026-06-30', 160903.31, 160903.31, 160903.31, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Balanced full-system demo reconciliation.', '2026-07-28 05:26:29', '2026-07-28 05:26:29');

-- --------------------------------------------------------

--
-- Table structure for table `account_reconciliation_items`
--

CREATE TABLE `account_reconciliation_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `account_reconciliation_id` bigint(20) UNSIGNED NOT NULL,
  `kind` varchar(255) NOT NULL,
  `direction` varchar(255) NOT NULL,
  `description` varchar(255) NOT NULL,
  `reference` varchar(255) DEFAULT NULL,
  `amount` decimal(16,2) NOT NULL,
  `cleared` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `assets`
--

CREATE TABLE `assets` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `asset_purchase_id` bigint(20) UNSIGNED DEFAULT NULL,
  `asset_code` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` enum('well','reservoir','generator','solar','technical') NOT NULL,
  `status` enum('active','inactive','maintenance','retired') NOT NULL DEFAULT 'active',
  `service_area_id` bigint(20) UNSIGNED DEFAULT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `purchase_cost` decimal(16,2) DEFAULT NULL,
  `purchase_date` date DEFAULT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `assets`
--

INSERT INTO `assets` (`id`, `asset_purchase_id`, `asset_code`, `name`, `type`, `status`, `service_area_id`, `latitude`, `longitude`, `address`, `purchase_cost`, `purchase_date`, `warranty_expiry`, `supplier_id`, `attributes`, `created_by`, `notes`, `created_at`, `updated_at`) VALUES
(1, NULL, 'ASSET-WELL-DEMO', 'Main Production Well', 'well', 'active', 1, NULL, NULL, NULL, 350000.00, '2025-01-15', NULL, NULL, NULL, 1, 'Inventory and assets workflow demonstration record.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, NULL, 'ASSET-GEN-DEMO', 'Backup Generator', 'generator', 'maintenance', 1, NULL, NULL, NULL, 180000.00, '2025-03-10', NULL, 2, NULL, 1, 'Inventory and assets workflow demonstration record.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 1, 'DEMO-SOLAR-001', 'Solar Pump Panel', 'solar', 'active', 1, NULL, NULL, 'Karte Parwan Zone', 15000.00, '2026-07-22', '2027-07-24', 1, NULL, 3, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(4, 1, 'DEMO-SOLAR-002', 'Solar Pump Panel', 'solar', 'active', 1, NULL, NULL, 'Karte Parwan Zone', 15000.00, '2026-07-22', '2027-07-24', 1, NULL, 3, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(5, 2, 'DEMO-PUMP', 'Submersible Water Pump', 'technical', 'active', 2, NULL, NULL, 'Khair Khana Zone', 45000.00, '2026-07-23', '2027-07-24', 2, NULL, 3, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(6, 3, 'DEMO-GEN-001', 'Portable Field Generator', 'generator', 'active', 3, NULL, NULL, 'Dasht-e-Barchi Zone', 8000.00, '2026-07-24', '2027-07-24', 3, NULL, 3, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(7, 3, 'DEMO-GEN-002', 'Portable Field Generator', 'generator', 'active', 3, NULL, NULL, 'Dasht-e-Barchi Zone', 8000.00, '2026-07-24', '2027-07-24', 3, NULL, 3, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(8, 3, 'DEMO-GEN-003', 'Portable Field Generator', 'generator', 'active', 3, NULL, NULL, 'Dasht-e-Barchi Zone', 8000.00, '2026-07-24', '2027-07-24', 3, NULL, 3, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `asset_maintenance`
--

CREATE TABLE `asset_maintenance` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `asset_id` bigint(20) UNSIGNED NOT NULL,
  `maintenance_type` enum('preventive','corrective','emergency') NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `cost` decimal(16,2) DEFAULT NULL,
  `performed_at` date NOT NULL,
  `next_due_date` date DEFAULT NULL,
  `status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  `performed_by` varchar(255) DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `asset_maintenance`
--

INSERT INTO `asset_maintenance` (`id`, `asset_id`, `maintenance_type`, `title`, `description`, `cost`, `performed_at`, `next_due_date`, `status`, `performed_by`, `created_by`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 'preventive', 'Quarterly pump inspection', 'Inspect pump, water pressure, wiring, and safety controls.', 2500.00, '2026-07-28', '2026-10-28', 'completed', 'Ahmad Karimi', 1, NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 2, 'corrective', 'Generator oil and filter service', 'Replace oil and filters before returning the generator to service.', 1800.00, '2026-07-28', '2026-08-28', 'in_progress', 'Ahmad Karimi', 1, NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 3, 'preventive', 'Solar panel electrical inspection', 'Inspect panel connections and pump controller.', 1200.00, '2026-07-26', '2026-10-26', 'completed', 'Ahmad Karimi', 1, 'Third maintenance record for report verification.', '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `asset_purchases`
--

CREATE TABLE `asset_purchases` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `purchase_number` varchar(255) NOT NULL,
  `asset_code_prefix` varchar(100) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(50) NOT NULL,
  `quantity` int(10) UNSIGNED NOT NULL,
  `unit_cost` decimal(16,2) NOT NULL,
  `total_amount` decimal(16,2) NOT NULL,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `service_area_id` bigint(20) UNSIGNED DEFAULT NULL,
  `financial_category_id` bigint(20) UNSIGNED NOT NULL,
  `payment_method_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_account_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `status` varchar(30) NOT NULL DEFAULT 'pending_review',
  `asset_status` varchar(30) NOT NULL DEFAULT 'active',
  `purchase_date` date NOT NULL,
  `warranty_expiry` date DEFAULT NULL,
  `invoice_number` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `attachment_path` varchar(255) DEFAULT NULL,
  `attachment_original_name` varchar(255) DEFAULT NULL,
  `attributes` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`attributes`)),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `asset_purchases`
--

INSERT INTO `asset_purchases` (`id`, `purchase_number`, `asset_code_prefix`, `name`, `type`, `quantity`, `unit_cost`, `total_amount`, `supplier_id`, `service_area_id`, `financial_category_id`, `payment_method_id`, `accounting_account_id`, `accounting_transaction_id`, `created_by`, `status`, `asset_status`, `purchase_date`, `warranty_expiry`, `invoice_number`, `address`, `attachment_path`, `attachment_original_name`, `attributes`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'ASP-20260728-00001', 'DEMO-SOLAR', 'Solar Pump Panel', 'solar', 2, 15000.00, 30000.00, 1, 1, 37, 2, 2, 31, 3, 'approved', 'active', '2026-07-22', '2027-07-24', 'DEMO-ASSET-INVOICE-1', 'Karte Parwan Zone', NULL, NULL, NULL, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(2, 'ASP-20260728-00002', 'DEMO-PUMP', 'Submersible Water Pump', 'technical', 1, 45000.00, 45000.00, 2, 2, 37, 1, 1, 32, 3, 'approved', 'active', '2026-07-23', '2027-07-24', 'DEMO-ASSET-INVOICE-2', 'Khair Khana Zone', NULL, NULL, NULL, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(3, 'ASP-20260728-00003', 'DEMO-GEN', 'Portable Field Generator', 'generator', 3, 8000.00, 24000.00, 3, 3, 37, 3, 6, 33, 3, 'approved', 'active', '2026-07-24', '2027-07-24', 'DEMO-ASSET-INVOICE-3', 'Dasht-e-Barchi Zone', NULL, NULL, NULL, 'Approved asset purchase generated from the full-system demo.', '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `attendance_records`
--

CREATE TABLE `attendance_records` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `leave_request_id` bigint(20) UNSIGNED DEFAULT NULL,
  `biometric_import_batch_id` bigint(20) UNSIGNED DEFAULT NULL,
  `recorded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `attendance_date` date NOT NULL,
  `check_in` time DEFAULT NULL,
  `check_out` time DEFAULT NULL,
  `attendance_status` varchar(255) NOT NULL DEFAULT 'present',
  `is_paid` tinyint(1) NOT NULL DEFAULT 1,
  `worked_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `late_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `overtime_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `source` varchar(255) NOT NULL DEFAULT 'manual',
  `external_reference` varchar(255) DEFAULT NULL,
  `approval_status` varchar(255) NOT NULL DEFAULT 'pending',
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `attendance_records`
--

INSERT INTO `attendance_records` (`id`, `employee_id`, `leave_request_id`, `biometric_import_batch_id`, `recorded_by`, `approved_by`, `attendance_date`, `check_in`, `check_out`, `attendance_status`, `is_paid`, `worked_minutes`, `late_minutes`, `overtime_minutes`, `source`, `external_reference`, `approval_status`, `approved_at`, `rejection_reason`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 1, NULL, 2, 2, '2026-06-10', NULL, NULL, 'leave', 1, 0, 0, 0, 'leave', NULL, 'approved', '2026-07-28 05:26:25', NULL, 'annual', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(2, 1, 1, NULL, 2, 2, '2026-06-11', NULL, NULL, 'leave', 1, 0, 0, 0, 'leave', NULL, 'approved', '2026-07-28 05:26:25', NULL, 'annual', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(3, 1, NULL, NULL, 4, 2, '2026-06-01', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-01 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(4, 1, NULL, NULL, 4, 2, '2026-06-02', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-02 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(5, 1, NULL, NULL, 4, 2, '2026-06-03', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-03 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(6, 1, NULL, NULL, 4, 2, '2026-06-04', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-04 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(7, 1, NULL, NULL, 4, 2, '2026-06-05', '07:50:00', '15:30:00', 'present', 1, 430, 10, 0, 'manual', NULL, 'approved', '2026-06-05 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(8, 1, NULL, NULL, 4, 2, '2026-06-06', '07:30:00', '16:30:00', 'present', 1, 510, 0, 60, 'manual', NULL, 'approved', '2026-06-06 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(9, 1, NULL, NULL, 4, 2, '2026-06-08', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-08 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(10, 1, NULL, NULL, 4, 2, '2026-06-09', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-09 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(11, 1, NULL, NULL, 4, 2, '2026-06-12', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-12 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(12, 1, NULL, NULL, 4, 2, '2026-06-13', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-13 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(13, 1, NULL, NULL, 4, 2, '2026-06-15', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-15 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(14, 1, NULL, NULL, 4, 2, '2026-06-16', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-16 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(15, 1, NULL, NULL, 4, 2, '2026-06-17', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-17 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(16, 1, NULL, NULL, 4, 2, '2026-06-19', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-19 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(17, 1, NULL, NULL, 4, 2, '2026-06-20', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-20 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(18, 1, NULL, NULL, 4, 2, '2026-06-22', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-22 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(19, 1, NULL, NULL, 4, 2, '2026-06-23', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-23 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(20, 1, NULL, NULL, 4, 2, '2026-06-24', NULL, NULL, 'absent', 0, 0, 0, 0, 'manual', NULL, 'approved', '2026-06-24 12:30:00', NULL, 'Demo approved absence.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(21, 1, NULL, NULL, 4, 2, '2026-06-25', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-25 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(22, 1, NULL, NULL, 4, 2, '2026-06-26', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-26 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(23, 1, NULL, NULL, 4, 2, '2026-06-27', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-27 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(24, 1, NULL, NULL, 4, 2, '2026-06-29', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-29 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(25, 1, NULL, NULL, 4, 2, '2026-06-30', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-30 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(26, 2, NULL, NULL, 4, 2, '2026-06-01', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-01 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(27, 2, NULL, NULL, 4, 2, '2026-06-02', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-02 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(28, 2, NULL, NULL, 4, 2, '2026-06-03', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-03 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(29, 2, NULL, NULL, 4, 2, '2026-06-04', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-04 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(30, 2, NULL, NULL, 4, 2, '2026-06-05', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-05 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(31, 2, NULL, NULL, 4, 2, '2026-06-06', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-06 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(32, 2, NULL, NULL, 4, 2, '2026-06-08', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-08 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(33, 2, NULL, NULL, 4, 2, '2026-06-09', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-09 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(34, 2, NULL, NULL, 4, 2, '2026-06-10', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-10 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(35, 2, NULL, NULL, 4, 2, '2026-06-11', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-11 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(36, 2, NULL, NULL, 4, 2, '2026-06-12', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-12 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(37, 2, NULL, NULL, 4, 2, '2026-06-13', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-13 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(38, 2, NULL, NULL, 4, 2, '2026-06-15', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-15 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(39, 2, NULL, NULL, 4, 2, '2026-06-16', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-16 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(40, 2, NULL, NULL, 4, 2, '2026-06-17', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-17 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(41, 2, NULL, NULL, 4, 2, '2026-06-19', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-19 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(42, 2, NULL, NULL, 4, 2, '2026-06-20', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-20 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(43, 2, NULL, NULL, 4, 2, '2026-06-22', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-22 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(44, 2, NULL, NULL, 4, 2, '2026-06-23', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-23 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(45, 2, NULL, NULL, 4, 2, '2026-06-24', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-24 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(46, 2, NULL, NULL, 4, 2, '2026-06-25', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-25 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(47, 2, NULL, NULL, 4, 2, '2026-06-26', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-26 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(48, 2, NULL, NULL, 4, 2, '2026-06-27', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-27 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(49, 2, NULL, NULL, 4, 2, '2026-06-29', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-29 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(50, 2, NULL, NULL, 4, 2, '2026-06-30', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-30 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(51, 3, NULL, NULL, 4, 2, '2026-06-01', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-01 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(52, 3, NULL, NULL, 4, 2, '2026-06-02', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-02 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(53, 3, NULL, NULL, 4, 2, '2026-06-03', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-03 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(54, 3, NULL, NULL, 4, 2, '2026-06-04', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-04 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(55, 3, NULL, NULL, 4, 2, '2026-06-05', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-05 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(56, 3, NULL, NULL, 4, 2, '2026-06-06', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-06 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(57, 3, NULL, NULL, 4, 2, '2026-06-08', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-08 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(58, 3, NULL, NULL, 4, 2, '2026-06-09', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-09 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(59, 3, NULL, NULL, 4, 2, '2026-06-10', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-10 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(60, 3, NULL, NULL, 4, 2, '2026-06-11', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-11 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(61, 3, NULL, NULL, 4, 2, '2026-06-12', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-12 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(62, 3, NULL, NULL, 4, 2, '2026-06-13', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-13 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(63, 3, NULL, NULL, 4, 2, '2026-06-15', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-15 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(64, 3, NULL, NULL, 4, 2, '2026-06-16', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-16 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(65, 3, NULL, NULL, 4, 2, '2026-06-17', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-17 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(66, 3, NULL, NULL, 4, 2, '2026-06-19', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-19 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(67, 3, NULL, NULL, 4, 2, '2026-06-20', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-20 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(68, 3, NULL, NULL, 4, 2, '2026-06-22', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-22 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(69, 3, NULL, NULL, 4, 2, '2026-06-23', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-23 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(70, 3, NULL, NULL, 4, 2, '2026-06-24', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-24 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(71, 3, NULL, NULL, 4, 2, '2026-06-25', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-25 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(72, 3, NULL, NULL, 4, 2, '2026-06-26', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-26 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(73, 3, NULL, NULL, 4, 2, '2026-06-27', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-27 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(74, 3, NULL, NULL, 4, 2, '2026-06-29', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-29 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(75, 3, NULL, NULL, 4, 2, '2026-06-30', '08:30:00', '16:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-30 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(76, 4, NULL, NULL, 4, 2, '2026-06-01', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-01 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(77, 4, NULL, NULL, 4, 2, '2026-06-02', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-02 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(78, 4, NULL, NULL, 4, 2, '2026-06-03', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-03 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(79, 4, NULL, NULL, 4, 2, '2026-06-04', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-04 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(80, 4, NULL, NULL, 4, 2, '2026-06-05', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-05 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(81, 4, NULL, NULL, 4, 2, '2026-06-06', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-06 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(82, 4, NULL, NULL, 4, 2, '2026-06-08', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-08 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(83, 4, NULL, NULL, 4, 2, '2026-06-09', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-09 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(84, 4, NULL, NULL, 4, 2, '2026-06-10', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-10 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(85, 4, NULL, NULL, 4, 2, '2026-06-11', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-11 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(86, 4, NULL, NULL, 4, 2, '2026-06-12', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-12 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(87, 4, NULL, NULL, 4, 2, '2026-06-13', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-13 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(88, 4, NULL, NULL, 4, 2, '2026-06-15', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-15 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(89, 4, NULL, NULL, 4, 2, '2026-06-16', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-16 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(90, 4, NULL, NULL, 4, 2, '2026-06-17', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-17 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(91, 4, NULL, NULL, 4, 2, '2026-06-19', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-19 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(92, 4, NULL, NULL, 4, 2, '2026-06-20', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-20 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(93, 4, NULL, NULL, 4, 2, '2026-06-22', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-22 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(94, 4, NULL, NULL, 4, 2, '2026-06-23', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-23 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(95, 4, NULL, NULL, 4, 2, '2026-06-24', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-24 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(96, 4, NULL, NULL, 4, 2, '2026-06-25', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-25 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(97, 4, NULL, NULL, 4, 2, '2026-06-26', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-26 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(98, 4, NULL, NULL, 4, 2, '2026-06-27', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-27 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(99, 4, NULL, NULL, 4, 2, '2026-06-29', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-29 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(100, 4, NULL, NULL, 4, 2, '2026-06-30', '08:00:00', '16:00:00', 'present', 1, 480, 0, 0, 'manual', NULL, 'approved', '2026-06-30 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(101, 5, NULL, NULL, 4, 2, '2026-06-01', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-01 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(102, 5, NULL, NULL, 4, 2, '2026-06-02', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-02 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(103, 5, NULL, NULL, 4, 2, '2026-06-03', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-03 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(104, 5, NULL, NULL, 4, 2, '2026-06-04', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-04 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(105, 5, NULL, NULL, 4, 2, '2026-06-05', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-05 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(106, 5, NULL, NULL, 4, 2, '2026-06-06', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-06 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(107, 5, NULL, NULL, 4, 2, '2026-06-08', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-08 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(108, 5, NULL, NULL, 4, 2, '2026-06-09', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-09 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(109, 5, NULL, NULL, 4, 2, '2026-06-10', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-10 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(110, 5, NULL, NULL, 4, 2, '2026-06-11', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-11 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(111, 5, NULL, NULL, 4, 2, '2026-06-12', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-12 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(112, 5, NULL, NULL, 4, 2, '2026-06-13', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-13 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(113, 5, NULL, NULL, 4, 2, '2026-06-15', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-15 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(114, 5, NULL, NULL, 4, 2, '2026-06-16', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-16 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(115, 5, NULL, NULL, 4, 2, '2026-06-17', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-17 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(116, 5, NULL, NULL, 4, 2, '2026-06-19', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-19 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(117, 5, NULL, NULL, 4, 2, '2026-06-20', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-20 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(118, 5, NULL, NULL, 4, 2, '2026-06-22', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-22 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(119, 5, NULL, NULL, 4, 2, '2026-06-23', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-23 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(120, 5, NULL, NULL, 4, 2, '2026-06-24', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-24 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(121, 5, NULL, NULL, 4, 2, '2026-06-25', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-25 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(122, 5, NULL, NULL, 4, 2, '2026-06-26', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-26 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(123, 5, NULL, NULL, 4, 2, '2026-06-27', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-27 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(124, 5, NULL, NULL, 4, 2, '2026-06-29', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-29 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(125, 5, NULL, NULL, 4, 2, '2026-06-30', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-06-30 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(126, 5, NULL, NULL, 4, 2, '2026-07-01', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-01 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(127, 5, NULL, NULL, 4, 2, '2026-07-02', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-02 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(128, 5, NULL, NULL, 4, 2, '2026-07-03', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-03 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(129, 5, NULL, NULL, 4, 2, '2026-07-04', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-04 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(130, 5, NULL, NULL, 4, 2, '2026-07-06', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-06 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(131, 5, NULL, NULL, 4, 2, '2026-07-07', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-07 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(132, 5, NULL, NULL, 4, 2, '2026-07-08', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-08 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(133, 5, NULL, NULL, 4, 2, '2026-07-09', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-09 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(134, 5, NULL, NULL, 4, 2, '2026-07-10', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-10 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(135, 5, NULL, NULL, 4, 2, '2026-07-11', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-11 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(136, 5, NULL, NULL, 4, 2, '2026-07-13', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-13 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(137, 5, NULL, NULL, 4, 2, '2026-07-15', '07:30:00', '15:30:00', 'present', 1, 450, 0, 0, 'manual', NULL, 'approved', '2026-07-15 12:30:00', NULL, 'Demo approved attendance.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(138, 1, NULL, 1, 4, NULL, '2026-07-16', '07:32:00', '15:35:00', 'present', 1, 453, 0, 0, 'biometric', 'DEVICE-DEMO-001', 'pending', NULL, NULL, 'Imported from the Phase 6 demo biometric batch.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(139, 3, NULL, 1, 4, NULL, '2026-07-16', '08:31:00', '16:32:00', 'present', 1, 451, 0, 0, 'biometric', 'DEVICE-DEMO-002', 'pending', NULL, NULL, 'Imported from the Phase 6 demo biometric batch.', '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `billing_periods`
--

CREATE TABLE `billing_periods` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `starts_on` date NOT NULL,
  `ends_on` date NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'open',
  `locked_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `billing_periods`
--

INSERT INTO `billing_periods` (`id`, `name`, `code`, `starts_on`, `ends_on`, `status`, `locked_at`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'April 2026', '2026-04', '2026-04-01', '2026-04-30', 'closed', NULL, NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(2, 'May 2026', '2026-05', '2026-05-01', '2026-05-31', 'locked', '2026-06-01 03:30:00', NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(3, 'June 2026', '2026-06', '2026-06-01', '2026-06-30', 'closed', NULL, NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(4, 'TEST July 2026', 'TEST-2026-07', '2026-07-01', '2026-07-31', 'open', NULL, 'Open period used by demo meter readings.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(5, 'Augest', '2026-08', '2026-08-01', '2026-08-31', 'open', NULL, 'sdfsfsdfsfsdfs', '2026-07-28 07:08:47', '2026-07-28 07:08:47');

-- --------------------------------------------------------

--
-- Table structure for table `biometric_import_batches`
--

CREATE TABLE `biometric_import_batches` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `imported_by` bigint(20) UNSIGNED DEFAULT NULL,
  `batch_number` varchar(255) NOT NULL,
  `original_name` varchar(255) NOT NULL,
  `path` varchar(255) NOT NULL,
  `total_rows` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `imported_rows` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `failed_rows` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `status` varchar(255) NOT NULL DEFAULT 'processing',
  `errors` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`errors`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `biometric_import_batches`
--

INSERT INTO `biometric_import_batches` (`id`, `imported_by`, `batch_number`, `original_name`, `path`, `total_rows`, `imported_rows`, `failed_rows`, `status`, `errors`, `created_at`, `updated_at`) VALUES
(1, 4, 'BIO-DEMO-00001', 'phase-six-demo.csv', 'biometric-imports/phase-six-demo.csv', 3, 2, 1, 'completed_with_errors', '[{\"row\":4,\"message\":\"Employee code UNKNOWN was not found.\"}]', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 4, 'BIO-DEMO-00002', 'full-system-demo-2.csv', 'biometric-imports/full-system-demo-2.csv', 2, 2, 0, 'completed', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 4, 'BIO-DEMO-00003', 'full-system-demo-3.csv', 'biometric-imports/full-system-demo-3.csv', 3, 0, 3, 'failed', '[{\"row\":2,\"message\":\"Invalid employee number.\"}]', '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `cache`
--

CREATE TABLE `cache` (
  `key` varchar(255) NOT NULL,
  `value` mediumtext NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `cache_locks`
--

CREATE TABLE `cache_locks` (
  `key` varchar(255) NOT NULL,
  `owner` varchar(255) NOT NULL,
  `expiration` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customers`
--

CREATE TABLE `customers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `service_area_id` bigint(20) UNSIGNED NOT NULL,
  `subscription_code` varchar(255) DEFAULT NULL,
  `subscription_date` date DEFAULT NULL,
  `name` varchar(255) NOT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `father_name` varchar(255) DEFAULT NULL,
  `grandfather_name` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `secondary_phone` varchar(255) DEFAULT NULL,
  `tazkira_number` varchar(255) DEFAULT NULL,
  `house_number` varchar(255) DEFAULT NULL,
  `nearest_house_number` varchar(255) DEFAULT NULL,
  `street_number` varchar(255) DEFAULT NULL,
  `original_residence` varchar(255) DEFAULT NULL,
  `current_residence` varchar(255) DEFAULT NULL,
  `meter_size` varchar(255) DEFAULT NULL,
  `connection_fee` decimal(14,2) NOT NULL DEFAULT 0.00,
  `meter_fee` decimal(14,2) NOT NULL DEFAULT 0.00,
  `agreement_discount_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `agreement_paid_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `agreement_payment_method_id` bigint(20) UNSIGNED DEFAULT NULL,
  `agreement_accounting_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `agreement_payment_received_by` bigint(20) UNSIGNED DEFAULT NULL,
  `agreement_payment_date` date DEFAULT NULL,
  `agreement_payment_reference` varchar(255) DEFAULT NULL,
  `agreement_payment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `agreement_remaining_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `discount_approved_by` varchar(255) DEFAULT NULL,
  `agreement_status` varchar(255) NOT NULL DEFAULT 'draft',
  `agreement_printed_at` timestamp NULL DEFAULT NULL,
  `submitted_for_approval_at` timestamp NULL DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `address` text DEFAULT NULL,
  `opening_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `current_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `documents` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`documents`)),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customers`
--

INSERT INTO `customers` (`id`, `service_area_id`, `subscription_code`, `subscription_date`, `name`, `last_name`, `father_name`, `grandfather_name`, `phone`, `secondary_phone`, `tazkira_number`, `house_number`, `nearest_house_number`, `street_number`, `original_residence`, `current_residence`, `meter_size`, `connection_fee`, `meter_fee`, `agreement_discount_amount`, `agreement_paid_amount`, `agreement_payment_method_id`, `agreement_accounting_account_id`, `agreement_payment_received_by`, `agreement_payment_date`, `agreement_payment_reference`, `agreement_payment_id`, `agreement_remaining_amount`, `discount_approved_by`, `agreement_status`, `agreement_printed_at`, `submitted_for_approval_at`, `approved_by`, `approved_at`, `rejected_by`, `rejected_at`, `rejection_reason`, `address`, `opening_balance`, `current_balance`, `status`, `documents`, `notes`, `created_at`, `updated_at`) VALUES
(1, 4, 'TEST-SUB-0001', '2026-07-18', 'TEST Ahmad', 'Rahimi', 'TEST Karim', 'TEST Abdul', '+93797001001', '+93797002001', 'TEST-TAZKIRA-1001', 'TEST-H-01', NULL, 'TEST-S-01', NULL, 'Kabul', 'Half inch', 1000.00, 500.00, 0.00, 800.00, NULL, NULL, NULL, NULL, NULL, NULL, 700.00, NULL, 'active', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'TEST Billing Zone, House 1', 0.00, 980.00, 'active', NULL, 'Demo customer intentionally left with partially paid contract and water invoices.', '2026-07-28 05:26:23', '2026-07-28 05:26:27'),
(2, 4, 'TEST-SUB-0002', '2026-07-18', 'TEST Laila', 'Noori', 'TEST Noor', 'TEST Wahid', '+93797001002', '+93797002002', 'TEST-TAZKIRA-1002', 'TEST-H-02', NULL, 'TEST-S-02', NULL, 'Kabul', 'Half inch', 800.00, 400.00, 0.00, 1200.00, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, 'active', NULL, '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, NULL, 'TEST Billing Zone, House 2', 0.00, 0.00, 'active', NULL, 'Fully paid demo customer with meter replacement and connection history.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 4, 'TEST-SUB-0003', '2026-07-18', 'TEST Mariam', 'Azizi', 'TEST Hamid', 'TEST Rahmat', '+93797001003', '+93797002003', 'TEST-TAZKIRA-1003', 'TEST-H-03', NULL, 'TEST-S-03', NULL, 'Kabul', 'Half inch', 1200.00, 600.00, 0.00, 500.00, NULL, NULL, NULL, NULL, NULL, NULL, 1300.00, NULL, 'active', NULL, '2026-07-28 05:26:24', NULL, NULL, NULL, NULL, NULL, 'TEST Billing Zone, House 3', 0.00, 1845.00, 'disconnected', NULL, 'Outstanding demo customer used to verify receivables and overdue workflows.', '2026-07-28 05:26:24', '2026-07-28 05:26:28'),
(4, 4, 'CUS-000004', '2026-07-28', 'samim', 'khan', 'khan', 'wali', '23423223', '234234234234', 'GH23423', 'H#90', 'H#32', '5 stret', 'kabul', 'kabul', 'Half inch', 200.00, 200.00, 0.00, 400.00, NULL, NULL, NULL, NULL, NULL, NULL, 0.00, NULL, 'active', NULL, '2026-07-28 07:01:11', NULL, NULL, NULL, NULL, NULL, 'kabul,afghanistan', 0.00, 0.00, 'active', NULL, 'This is some description', '2026-07-28 06:08:12', '2026-07-28 07:10:33');

-- --------------------------------------------------------

--
-- Table structure for table `customer_charges`
--

CREATE TABLE `customer_charges` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `customer_contract_id` bigint(20) UNSIGNED DEFAULT NULL,
  `invoice_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_charge_type_id` bigint(20) UNSIGNED DEFAULT NULL,
  `financial_category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL DEFAULT 'other',
  `amount` decimal(16,2) NOT NULL,
  `paid_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `remaining_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `charge_date` date NOT NULL,
  `paid_at` timestamp NULL DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'posted',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_charges`
--

INSERT INTO `customer_charges` (`id`, `customer_id`, `customer_contract_id`, `invoice_id`, `customer_charge_type_id`, `financial_category_id`, `accounting_transaction_id`, `created_by`, `title`, `type`, `amount`, `paid_amount`, `remaining_amount`, `charge_date`, `paid_at`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 1, 1, 38, NULL, 2, 'Connection fee', 'connection_fee', 1000.00, 800.00, 200.00, '2026-07-28', NULL, 'posted', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 1, 1, 1, 2, 42, NULL, 2, 'Meter installation fee', 'meter_fee', 500.00, 0.00, 500.00, '2026-07-28', NULL, 'posted', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 1, NULL, 3, 10, 43, NULL, 2, 'TEST Leak inspection service', 'test_service_fee', 150.00, 150.00, 0.00, '2026-07-18', '2026-07-17 19:30:00', 'posted', 'TEST charge converted to a payable invoice automatically.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(4, 2, 2, 4, 1, 38, NULL, 2, 'Connection fee', 'connection_fee', 800.00, 800.00, 0.00, '2026-07-28', '2026-07-17 19:30:00', 'posted', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(5, 2, 2, 4, 2, 42, NULL, 2, 'Meter installation fee', 'meter_fee', 400.00, 400.00, 0.00, '2026-07-28', '2026-07-17 19:30:00', 'posted', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(6, 2, NULL, 6, 10, 43, NULL, 2, 'TEST New booklet service', 'test_service_fee', 250.00, 250.00, 0.00, '2026-07-18', '2026-07-17 19:30:00', 'posted', 'TEST charge converted to a payable invoice automatically.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(7, 2, NULL, 7, 4, NULL, NULL, 2, 'Disconnection fee', 'penalty', 100.00, 100.00, 0.00, '2026-07-18', '2026-07-17 19:30:00', 'posted', 'TEST disconnection workflow.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(8, 2, NULL, 8, 6, NULL, NULL, 2, 'Reconnection fee', 'reconnection_fee', 200.00, 200.00, 0.00, '2026-07-18', '2026-07-17 19:30:00', 'posted', 'TEST reconnection workflow.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(9, 3, 3, 9, 1, 38, NULL, 2, 'Connection fee', 'connection_fee', 1200.00, 500.00, 700.00, '2026-07-28', NULL, 'posted', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(10, 3, 3, 9, 2, 42, NULL, 2, 'Meter installation fee', 'meter_fee', 600.00, 0.00, 600.00, '2026-07-28', NULL, 'posted', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(11, 3, NULL, 11, 4, NULL, NULL, 2, 'Disconnection fee', 'penalty', 100.00, 0.00, 100.00, '2026-07-18', NULL, 'posted', 'TEST disconnection workflow.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(12, 4, 4, 14, 1, 38, NULL, 1, 'Connection fee', 'connection_fee', 100.00, 0.00, 0.00, '2026-07-28', NULL, 'cancelled', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 06:26:14', '2026-07-28 06:30:20'),
(13, 4, 4, 14, 2, 42, NULL, 1, 'Meter installation fee', 'meter_fee', 100.00, 0.00, 0.00, '2026-07-28', NULL, 'cancelled', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 06:26:14', '2026-07-28 06:30:20'),
(14, 4, 5, 15, 1, 38, NULL, 1, 'Connection fee', 'connection_fee', 200.00, 200.00, 0.00, '2026-07-28', '2026-07-27 19:30:00', 'posted', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 07:01:11', '2026-07-28 07:01:28'),
(15, 4, 5, 15, 2, 42, NULL, 1, 'Meter installation fee', 'meter_fee', 200.00, 200.00, 0.00, '2026-07-28', '2026-07-27 19:30:00', 'posted', 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 07:01:11', '2026-07-28 07:01:28');

-- --------------------------------------------------------

--
-- Table structure for table `customer_charge_types`
--

CREATE TABLE `customer_charge_types` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(100) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `is_system` tinyint(1) NOT NULL DEFAULT 0,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_charge_types`
--

INSERT INTO `customer_charge_types` (`id`, `name`, `code`, `description`, `status`, `is_system`, `created_at`, `updated_at`) VALUES
(1, 'Connection Fee', 'connection_fee', NULL, 'active', 1, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(2, 'Meter Fee', 'meter_fee', NULL, 'active', 1, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(3, 'Replacement Fee', 'replacement_fee', NULL, 'active', 0, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(4, 'Penalty', 'penalty', NULL, 'active', 1, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(5, 'Service Fee', 'service_fee', NULL, 'active', 0, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(6, 'Reconnection Fee', 'reconnection_fee', NULL, 'active', 1, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(7, 'Booklet Fee', 'booklet_fee', NULL, 'active', 0, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(8, 'Name Change Fee', 'name_change_fee', NULL, 'active', 0, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(9, 'Other', 'other', NULL, 'active', 0, '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(10, 'TEST Service Fee', 'test_service_fee', 'General demo service charge.', 'active', 0, '2026-07-28 05:26:23', '2026-07-28 05:26:23');

-- --------------------------------------------------------

--
-- Table structure for table `customer_connection_events`
--

CREATE TABLE `customer_connection_events` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `processed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_charge_id` bigint(20) UNSIGNED DEFAULT NULL,
  `event_type` varchar(255) NOT NULL,
  `reason` text DEFAULT NULL,
  `fee` decimal(16,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'completed',
  `disconnected_at` date DEFAULT NULL,
  `reconnected_at` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_connection_events`
--

INSERT INTO `customer_connection_events` (`id`, `customer_id`, `processed_by`, `customer_charge_id`, `event_type`, `reason`, `fee`, `status`, `disconnected_at`, `reconnected_at`, `notes`, `created_at`, `updated_at`) VALUES
(1, 2, 2, 7, 'disconnection', 'TEST disconnection workflow.', 100.00, 'completed', '2026-07-18', NULL, 'TEST event fee converted to an invoice automatically.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 2, 2, 8, 'reconnection', 'TEST reconnection workflow.', 200.00, 'completed', NULL, '2026-07-18', 'TEST event fee converted to an invoice automatically.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 3, 2, 11, 'disconnection', 'TEST disconnection workflow.', 100.00, 'completed', '2026-07-18', NULL, 'TEST event fee converted to an invoice automatically.', '2026-07-28 05:26:24', '2026-07-28 05:26:24');

-- --------------------------------------------------------

--
-- Table structure for table `customer_contracts`
--

CREATE TABLE `customer_contracts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `contract_number` varchar(255) NOT NULL,
  `subscription_date` date DEFAULT NULL,
  `meter_size` varchar(255) DEFAULT NULL,
  `connection_fee` decimal(16,2) NOT NULL DEFAULT 0.00,
  `meter_fee` decimal(16,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `net_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `required_initial_payment` decimal(16,2) NOT NULL DEFAULT 0.00,
  `deposited_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `applied_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `remaining_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `discount_approved_by` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'draft',
  `printed_at` timestamp NULL DEFAULT NULL,
  `submitted_at` timestamp NULL DEFAULT NULL,
  `submitted_by` bigint(20) UNSIGNED DEFAULT NULL,
  `confirmed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `confirmed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `activated_at` timestamp NULL DEFAULT NULL,
  `cancelled_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_contracts`
--

INSERT INTO `customer_contracts` (`id`, `customer_id`, `created_by`, `updated_by`, `approved_by`, `rejected_by`, `contract_number`, `subscription_date`, `meter_size`, `connection_fee`, `meter_fee`, `discount_amount`, `net_amount`, `required_initial_payment`, `deposited_amount`, `applied_amount`, `remaining_amount`, `discount_approved_by`, `status`, `printed_at`, `submitted_at`, `submitted_by`, `confirmed_by`, `confirmed_at`, `approved_at`, `rejected_at`, `activated_at`, `cancelled_at`, `rejection_reason`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 5, NULL, NULL, 'CTR-20260728-00001', '2026-07-18', 'Half inch', 1000.00, 500.00, 0.00, 1500.00, 0.00, 0.00, 0.00, 700.00, NULL, 'active', NULL, NULL, NULL, 2, '2026-07-28 05:26:23', NULL, NULL, '2026-07-28 05:26:23', NULL, NULL, 'TEST contract confirmed without collecting money in advance.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 2, 2, 5, NULL, NULL, 'CTR-20260728-00002', '2026-07-18', 'Half inch', 800.00, 400.00, 0.00, 1200.00, 0.00, 0.00, 0.00, 0.00, NULL, 'active', NULL, NULL, NULL, 2, '2026-07-28 05:26:23', NULL, NULL, '2026-07-28 05:26:23', NULL, NULL, 'TEST contract paid after meter installation.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 3, 2, 5, NULL, NULL, 'CTR-20260728-00003', '2026-07-18', 'Half inch', 1200.00, 600.00, 0.00, 1800.00, 0.00, 0.00, 0.00, 1300.00, NULL, 'active', NULL, NULL, NULL, 2, '2026-07-28 05:26:24', NULL, NULL, '2026-07-28 05:26:24', NULL, NULL, 'TEST contract with a remaining balance after partial payment.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(4, 4, 1, 1, NULL, NULL, 'CTR-20260728-00004', '2026-07-28', 'Half inch', 100.00, 100.00, 0.00, 200.00, 0.00, 0.00, 0.00, 0.00, NULL, 'cancelled', NULL, NULL, NULL, 1, '2026-07-28 06:26:14', NULL, NULL, '2026-07-28 06:28:14', '2026-07-28 06:30:20', 'this is some description', 'dfsdfsfsdf', '2026-07-28 06:26:05', '2026-07-28 06:30:20'),
(5, 4, 1, 1, NULL, NULL, 'CTR-20260728-00005', '2026-07-28', 'Half inch', 200.00, 200.00, 0.00, 400.00, 0.00, 0.00, 0.00, 0.00, NULL, 'active', NULL, NULL, NULL, 1, '2026-07-28 07:01:11', NULL, NULL, '2026-07-28 07:06:51', NULL, NULL, NULL, '2026-07-28 07:01:07', '2026-07-28 07:06:51');

-- --------------------------------------------------------

--
-- Table structure for table `customer_deposits`
--

CREATE TABLE `customer_deposits` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_contract_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `payment_method_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_account_id` bigint(20) UNSIGNED NOT NULL,
  `received_by` bigint(20) UNSIGNED DEFAULT NULL,
  `applied_by` bigint(20) UNSIGNED DEFAULT NULL,
  `refunded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `refund_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `receipt_number` varchar(255) NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `applied_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `refunded_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `received_at` date NOT NULL,
  `refunded_at` date DEFAULT NULL,
  `applied_at` timestamp NULL DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `reference` varchar(255) DEFAULT NULL,
  `refund_receipt_number` varchar(255) DEFAULT NULL,
  `refund_reference` varchar(255) DEFAULT NULL,
  `refund_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_deposit_allocations`
--

CREATE TABLE `customer_deposit_allocations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_deposit_id` bigint(20) UNSIGNED NOT NULL,
  `customer_charge_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `customer_documents`
--

CREATE TABLE `customer_documents` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `uploaded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `document_type` varchar(255) DEFAULT NULL,
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `path` varchar(255) NOT NULL,
  `mime_type` varchar(255) DEFAULT NULL,
  `size` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_documents`
--

INSERT INTO `customer_documents` (`id`, `customer_id`, `uploaded_by`, `document_type`, `original_name`, `stored_name`, `path`, `mime_type`, `size`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 'TEST Identity', 'TEST-customer-0001.txt', '0a38c0d7-3de7-4fc5-aae5-04794fc7a349.txt', 'customer-documents/1/0a38c0d7-3de7-4fc5-aae5-04794fc7a349.txt', 'text/plain', 44, 'Uploaded by demo workflow.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 2, 2, 'TEST Identity', 'TEST-customer-0002.txt', '9450cb1b-72b0-490f-8c72-812f7462ddf6.txt', 'customer-documents/2/9450cb1b-72b0-490f-8c72-812f7462ddf6.txt', 'text/plain', 44, 'Uploaded by demo workflow.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 3, 2, 'TEST Identity', 'TEST-customer-0003.txt', 'e60b2d90-e72f-4a6a-b6d9-b238309f102a.txt', 'customer-documents/3/e60b2d90-e72f-4a6a-b6d9-b238309f102a.txt', 'text/plain', 44, 'Uploaded by demo workflow.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(4, 4, 1, 'dfsdf', 'New Project.png', 'af7f181f-0875-41af-9cdc-bce86f7da0a2.png', 'customer-documents/4/af7f181f-0875-41af-9cdc-bce86f7da0a2.png', 'image/png', 41920, 'sdfsdf', '2026-07-28 06:08:14', '2026-07-28 06:08:14');

-- --------------------------------------------------------

--
-- Table structure for table `customer_service_requests`
--

CREATE TABLE `customer_service_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `assigned_to` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `request_number` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL DEFAULT 'complaint',
  `priority` varchar(255) NOT NULL DEFAULT 'normal',
  `description` text NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'open',
  `requested_at` date NOT NULL,
  `assigned_at` timestamp NULL DEFAULT NULL,
  `resolved_at` timestamp NULL DEFAULT NULL,
  `closed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `resolution` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `customer_service_requests`
--

INSERT INTO `customer_service_requests` (`id`, `customer_id`, `assigned_to`, `created_by`, `request_number`, `type`, `priority`, `description`, `status`, `requested_at`, `assigned_at`, `resolved_at`, `closed_by`, `closed_at`, `resolution`, `created_at`, `updated_at`) VALUES
(1, 1, 5, 2, 'SR-20260728-00001', 'low_pressure', 'normal', 'TEST customer reports low pressure during evening hours.', 'assigned', '2026-07-18', '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 2, 5, 2, 'SR-20260728-00002', 'meter_problem', 'high', 'TEST meter glass is damaged and requires replacement.', 'assigned', '2026-07-18', '2026-07-28 05:26:23', NULL, NULL, NULL, NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 3, 5, 2, 'SR-20260728-00003', 'leak', 'urgent', 'TEST visible pipe leak awaiting technician inspection.', 'assigned', '2026-07-18', '2026-07-28 05:26:24', NULL, NULL, NULL, NULL, '2026-07-28 05:26:24', '2026-07-28 05:26:24');

-- --------------------------------------------------------

--
-- Table structure for table `departments`
--

CREATE TABLE `departments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `departments`
--

INSERT INTO `departments` (`id`, `code`, `name`, `description`, `status`, `created_at`, `updated_at`) VALUES
(1, 'operations', 'Operations', 'Water network field operations.', 'active', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(2, 'human_resources', 'Human Resources', 'People, attendance, leave, and payroll administration.', 'active', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(3, 'finance', 'Finance', 'Accounts and payroll processing.', 'active', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(4, 'management', 'Management', 'Operational review and approval.', 'active', '2026-07-28 05:26:25', '2026-07-28 05:26:25');

-- --------------------------------------------------------

--
-- Table structure for table `employees`
--

CREATE TABLE `employees` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `job_position_id` bigint(20) UNSIGNED DEFAULT NULL,
  `service_area_id` bigint(20) UNSIGNED DEFAULT NULL,
  `referred_by_shareholder_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `updated_by` bigint(20) UNSIGNED DEFAULT NULL,
  `employee_number` varchar(255) NOT NULL,
  `biometric_id` varchar(255) DEFAULT NULL,
  `first_name` varchar(255) NOT NULL,
  `last_name` varchar(255) DEFAULT NULL,
  `father_name` varchar(255) DEFAULT NULL,
  `grandfather_name` varchar(255) DEFAULT NULL,
  `gender` varchar(255) DEFAULT NULL,
  `date_of_birth` date DEFAULT NULL,
  `tazkira_number` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `secondary_phone` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `address` text DEFAULT NULL,
  `emergency_contact_name` varchar(255) DEFAULT NULL,
  `emergency_contact_phone` varchar(255) DEFAULT NULL,
  `hire_date` date NOT NULL,
  `termination_date` date DEFAULT NULL,
  `employment_type` varchar(255) NOT NULL DEFAULT 'permanent',
  `salary_type` varchar(255) NOT NULL DEFAULT 'fixed',
  `base_salary` decimal(16,2) NOT NULL DEFAULT 0.00,
  `daily_rate` decimal(16,2) NOT NULL DEFAULT 0.00,
  `overtime_hourly_rate` decimal(16,2) NOT NULL DEFAULT 0.00,
  `standard_daily_hours` decimal(5,2) NOT NULL DEFAULT 8.00,
  `work_start_time` time NOT NULL DEFAULT '08:00:00',
  `work_end_time` time NOT NULL DEFAULT '16:00:00',
  `work_days` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`work_days`)),
  `bank_name` varchar(255) DEFAULT NULL,
  `bank_account_number` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employees`
--

INSERT INTO `employees` (`id`, `user_id`, `job_position_id`, `service_area_id`, `referred_by_shareholder_id`, `created_by`, `updated_by`, `employee_number`, `biometric_id`, `first_name`, `last_name`, `father_name`, `grandfather_name`, `gender`, `date_of_birth`, `tazkira_number`, `phone`, `secondary_phone`, `email`, `address`, `emergency_contact_name`, `emergency_contact_phone`, `hire_date`, `termination_date`, `employment_type`, `salary_type`, `base_salary`, `daily_rate`, `overtime_hourly_rate`, `standard_daily_hours`, `work_start_time`, `work_end_time`, `work_days`, `bank_name`, `bank_account_number`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 5, 1, 1, NULL, 1, 1, 'EMP-00001', 'BIO-1001', 'Ahmad', 'Karimi', 'Abdul Karim', NULL, NULL, NULL, NULL, '0799111222', NULL, 'technician@waternet.local', 'Kabul, Afghanistan', 'Demo Emergency Contact', '0799888777', '2025-01-10', NULL, 'permanent', 'attendance', 18000.00, 0.00, 120.00, 8.00, '08:00:00', '16:00:00', '[1,2,3,4,5,6]', NULL, NULL, 'active', 'Phase 6 workflow demonstration employee.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(2, 4, 2, 1, NULL, 1, 1, 'EMP-00002', 'BIO-1002', 'Maryam', 'Habibi', 'Habibullah', NULL, NULL, NULL, NULL, '0799001002', NULL, 'hr@waternet.local', 'Kabul, Afghanistan', 'Demo Emergency Contact', '0799888777', '2024-03-01', NULL, 'permanent', 'fixed', 26000.00, 0.00, 150.00, 8.00, '08:00:00', '16:00:00', '[1,2,3,4,5,6]', NULL, NULL, 'active', 'Phase 6 workflow demonstration employee.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(3, 3, 3, 1, NULL, 1, 1, 'EMP-00003', 'BIO-1003', 'Laila', 'Rahimi', 'Rahim', NULL, NULL, NULL, NULL, '0799001003', NULL, 'accountant@waternet.local', 'Kabul, Afghanistan', 'Demo Emergency Contact', '0799888777', '2024-06-15', NULL, 'permanent', 'fixed', 24000.00, 0.00, 140.00, 8.00, '08:00:00', '16:00:00', '[1,2,3,4,5,6]', NULL, NULL, 'active', 'Phase 6 workflow demonstration employee.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(4, 2, 4, 1, NULL, 1, 1, 'EMP-00004', 'BIO-1004', 'Nadia', 'Safi', 'Mohammad Safi', NULL, NULL, NULL, NULL, '0799001001', NULL, 'manager@waternet.local', 'Kabul, Afghanistan', 'Demo Emergency Contact', '0799888777', '2023-01-01', NULL, 'permanent', 'fixed', 30000.00, 0.00, 180.00, 8.00, '08:00:00', '16:00:00', '[1,2,3,4,5,6]', NULL, NULL, 'active', 'Phase 6 workflow demonstration employee.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(5, 10, 1, 1, NULL, 1, 1, 'EMP-00005', 'BIO-1005', 'Farid', 'Safi', 'Abdul Wahid', NULL, NULL, NULL, NULL, '0799001004', NULL, 'farid.safi@waternet.local', 'Kabul, Afghanistan', 'Demo Emergency Contact', '0799888777', '2025-02-01', '2026-07-15', 'permanent', 'daily', 23400.00, 900.00, 100.00, 8.00, '08:00:00', '16:00:00', '[1,2,3,4,5,6]', NULL, NULL, 'terminated', 'Phase 6 workflow demonstration employee.', '2026-07-28 05:26:25', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `employee_adjustments`
--

CREATE TABLE `employee_adjustments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `payroll_item_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `adjustment_number` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `effective_date` date NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `title` varchar(255) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee_adjustments`
--

INSERT INTO `employee_adjustments` (`id`, `employee_id`, `payroll_item_id`, `created_by`, `approved_by`, `adjustment_number`, `type`, `amount`, `effective_date`, `status`, `approved_at`, `rejection_reason`, `title`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 4, 2, 'ADJ-DEMO-00001', 'bonus', 1000.00, '2026-06-30', 'applied', '2026-06-29 05:30:00', NULL, 'Emergency repair bonus', 'Approved bonus included in June payroll.', '2026-07-28 05:26:26', '2026-07-28 05:26:27'),
(2, 3, 3, 4, 2, 'ADJ-DEMO-00002', 'deduction', 500.00, '2026-06-30', 'applied', '2026-06-29 05:35:00', NULL, 'Approved equipment deduction', 'Approved one-time deduction included in June payroll.', '2026-07-28 05:26:26', '2026-07-28 05:26:27'),
(3, 3, NULL, 4, 2, 'ADJ-DEMO-00003', 'bonus', 750.00, '2026-07-31', 'approved', '2026-07-27 04:30:00', NULL, 'Inventory reconciliation bonus', 'Third adjustment record.', '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `employee_documents`
--

CREATE TABLE `employee_documents` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `uploaded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `document_type` varchar(255) NOT NULL DEFAULT 'other',
  `original_name` varchar(255) NOT NULL,
  `stored_name` varchar(255) NOT NULL,
  `path` varchar(255) NOT NULL,
  `mime_type` varchar(255) DEFAULT NULL,
  `size` bigint(20) UNSIGNED NOT NULL DEFAULT 0,
  `expires_on` date DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee_documents`
--

INSERT INTO `employee_documents` (`id`, `employee_id`, `uploaded_by`, `document_type`, `original_name`, `stored_name`, `path`, `mime_type`, `size`, `expires_on`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 4, 'identity', 'demo-identity-1.txt', 'demo-employee-1.txt', 'employee-documents/demo-employee-1.txt', 'text/plain', 41, NULL, 'Demo HR attachment.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 2, 4, 'identity', 'demo-identity-2.txt', 'demo-employee-2.txt', 'employee-documents/demo-employee-2.txt', 'text/plain', 42, NULL, 'Demo HR attachment.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 3, 4, 'identity', 'demo-identity-3.txt', 'demo-employee-3.txt', 'employee-documents/demo-employee-3.txt', 'text/plain', 41, NULL, 'Demo HR attachment.', '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `employee_leave_balances`
--

CREATE TABLE `employee_leave_balances` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `leave_policy_id` bigint(20) UNSIGNED NOT NULL,
  `year` smallint(5) UNSIGNED NOT NULL,
  `entitlement_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `carried_forward_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `adjustment_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee_leave_balances`
--

INSERT INTO `employee_leave_balances` (`id`, `employee_id`, `leave_policy_id`, `year`, `entitlement_days`, `carried_forward_days`, `adjustment_days`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 2025, 20.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(2, 1, 1, 2026, 20.00, 5.00, 1.00, 'One-day HR carry adjustment for the demo.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(3, 1, 3, 2026, 5.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(4, 1, 2, 2026, 10.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(5, 1, 4, 2026, 0.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(6, 2, 1, 2024, 16.67, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(7, 2, 1, 2025, 20.00, 5.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(8, 2, 1, 2026, 20.00, 5.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(9, 2, 3, 2026, 5.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(10, 2, 2, 2026, 10.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(11, 2, 4, 2026, 0.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(12, 3, 1, 2024, 11.67, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(13, 3, 1, 2025, 20.00, 5.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(14, 3, 1, 2026, 20.00, 5.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(15, 3, 3, 2026, 5.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(16, 3, 2, 2026, 10.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(17, 3, 4, 2026, 0.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(18, 4, 1, 2023, 20.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(19, 4, 1, 2024, 20.00, 5.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(20, 4, 1, 2025, 20.00, 5.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(21, 4, 1, 2026, 20.00, 5.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(22, 4, 3, 2026, 5.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(23, 4, 2, 2026, 10.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(24, 4, 4, 2026, 0.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(25, 5, 1, 2025, 18.33, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(26, 5, 1, 2026, 20.00, 5.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(27, 5, 3, 2026, 5.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(28, 5, 2, 2026, 10.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(29, 5, 4, 2026, 0.00, 0.00, 0.00, NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:26');

-- --------------------------------------------------------

--
-- Table structure for table `employee_payroll_deductions`
--

CREATE TABLE `employee_payroll_deductions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `payroll_deduction_rule_id` bigint(20) UNSIGNED NOT NULL,
  `assigned_by` bigint(20) UNSIGNED DEFAULT NULL,
  `override_value` decimal(16,4) DEFAULT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee_payroll_deductions`
--

INSERT INTO `employee_payroll_deductions` (`id`, `employee_id`, `payroll_deduction_rule_id`, `assigned_by`, `override_value`, `effective_from`, `effective_to`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 4, NULL, '2026-01-01', NULL, 'active', 'Phase 6 tax demonstration.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(2, 2, 1, 4, NULL, '2026-01-01', NULL, 'active', 'Phase 6 tax demonstration.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(3, 3, 1, 4, NULL, '2026-01-01', NULL, 'active', 'Phase 6 tax demonstration.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(4, 4, 1, 4, NULL, '2026-01-01', NULL, 'active', 'Phase 6 tax demonstration.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(5, 5, 1, 4, NULL, '2026-01-01', NULL, 'active', 'Phase 6 tax demonstration.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(6, 1, 2, 4, NULL, '2026-01-01', NULL, 'active', 'Phase 6 recurring deduction demonstration.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(7, 3, 2, 4, NULL, '2026-01-01', NULL, 'active', 'Phase 6 recurring deduction demonstration.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(8, 3, 3, 4, NULL, '2026-07-01', NULL, 'active', 'Third deduction rule assignment.', '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `employee_shift_assignments`
--

CREATE TABLE `employee_shift_assignments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `work_shift_id` bigint(20) UNSIGNED NOT NULL,
  `assigned_by` bigint(20) UNSIGNED DEFAULT NULL,
  `effective_from` date NOT NULL,
  `effective_to` date DEFAULT NULL,
  `work_days` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin NOT NULL CHECK (json_valid(`work_days`)),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee_shift_assignments`
--

INSERT INTO `employee_shift_assignments` (`id`, `employee_id`, `work_shift_id`, `assigned_by`, `effective_from`, `effective_to`, `work_days`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 4, '2026-01-01', NULL, '[1,2,3,4,5,6]', 'Phase 6 demonstration roster.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(2, 2, 3, 4, '2026-01-01', NULL, '[1,2,3,4,5,6]', 'Phase 6 demonstration roster.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(3, 3, 3, 4, '2026-01-01', NULL, '[1,2,3,4,5,6]', 'Phase 6 demonstration roster.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(4, 4, 1, 4, '2026-01-01', NULL, '[1,2,3,4,5,6]', 'Phase 6 demonstration roster.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(5, 5, 2, 4, '2026-01-01', NULL, '[1,2,3,4,5,6]', 'Phase 6 demonstration roster.', '2026-07-28 05:26:25', '2026-07-28 05:26:25');

-- --------------------------------------------------------

--
-- Table structure for table `employee_terminations`
--

CREATE TABLE `employee_terminations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `payment_method_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_account_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `termination_number` varchar(255) NOT NULL,
  `last_working_date` date NOT NULL,
  `termination_type` varchar(255) NOT NULL,
  `reason` text NOT NULL,
  `settlement_period_start` date NOT NULL,
  `final_salary` decimal(16,2) NOT NULL DEFAULT 0.00,
  `unused_leave_payout` decimal(16,2) NOT NULL DEFAULT 0.00,
  `severance_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `other_earnings` decimal(16,2) NOT NULL DEFAULT 0.00,
  `advance_recovery` decimal(16,2) NOT NULL DEFAULT 0.00,
  `other_deductions` decimal(16,2) NOT NULL DEFAULT 0.00,
  `net_settlement` decimal(16,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'pending_review',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `employee_terminations`
--

INSERT INTO `employee_terminations` (`id`, `employee_id`, `payment_method_id`, `accounting_account_id`, `accounting_transaction_id`, `created_by`, `reviewed_by`, `approved_by`, `rejected_by`, `termination_number`, `last_working_date`, `termination_type`, `reason`, `settlement_period_start`, `final_salary`, `unused_leave_payout`, `severance_amount`, `other_earnings`, `advance_recovery`, `other_deductions`, `net_settlement`, `status`, `reviewed_at`, `approved_at`, `rejected_at`, `rejection_reason`, `notes`, `created_at`, `updated_at`) VALUES
(1, 5, 2, 9, 14, 4, 2, 1, NULL, 'SET-DEMO-00001', '2026-07-15', 'resignation', 'Employee resignation after notice period.', '2026-07-01', 10800.00, 22500.00, 2000.00, 500.00, 3000.00, 500.00, 32300.00, 'approved', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, NULL, 'Approved final settlement demonstration.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 2, 2, 9, NULL, 4, NULL, NULL, 1, 'SET-DEMO-00002', '2026-08-15', 'termination', 'Demonstration final-settlement workflow.', '2026-08-01', 12000.00, 500.00, 1000.00, 0.00, 0.00, 0.00, 13500.00, 'rejected', NULL, NULL, '2026-07-27 06:30:00', 'Employment review is incomplete.', 'Additional termination workflow record.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 3, 2, 9, NULL, 4, NULL, NULL, NULL, 'SET-DEMO-00003', '2026-08-15', 'resignation', 'Demonstration final-settlement workflow.', '2026-08-01', 12000.00, 500.00, 1000.00, 0.00, 0.00, 0.00, 13500.00, 'pending_review', NULL, NULL, NULL, NULL, 'Additional termination workflow record.', '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `failed_jobs`
--

CREATE TABLE `failed_jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `uuid` varchar(255) NOT NULL,
  `connection` text NOT NULL,
  `queue` text NOT NULL,
  `payload` longtext NOT NULL,
  `exception` longtext NOT NULL,
  `failed_at` timestamp NOT NULL DEFAULT current_timestamp()
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `financial_categories`
--

CREATE TABLE `financial_categories` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `financial_categories`
--

INSERT INTO `financial_categories` (`id`, `name`, `code`, `type`, `description`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Water Bill Income', 'water_bill_income', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(2, 'Meter Installation Income', 'meter_installation_income', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(3, 'Meter Replacement Income', 'meter_replacement_income', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(4, 'New Connection Fee', 'new_connection_fee', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(5, 'Late Payment Penalty', 'late_payment_penalty', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(6, 'Shareholder Investment', 'shareholder_investment', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(7, 'Service Income', 'service_income', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(8, 'New Booklet Income', 'new_booklet_income', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(9, 'Name Change Fee', 'name_change_fee', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(10, 'Warehouse Income', 'warehouse_income', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(11, 'Other Income', 'other_income', 'income', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(12, 'Salary Expense', 'salary_expense', 'expense', NULL, 'active', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(13, 'Office Rent', 'office_rent', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(14, 'Electricity Bill', 'electricity_bill', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(15, 'Internet Expense', 'internet_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(16, 'Fuel Expense', 'fuel_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(17, 'Transport Expense', 'transport_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(18, 'Pipe Repair Expense', 'pipe_repair_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(19, 'Pump Repair Expense', 'pump_repair_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(20, 'Generator Maintenance', 'generator_maintenance', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(21, 'Water System Maintenance', 'water_system_maintenance', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(22, 'Equipment Purchase', 'equipment_purchase', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(23, 'Meter Purchase', 'meter_purchase', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(24, 'Pipe Purchase', 'pipe_purchase', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(25, 'Half Inch Purchase', 'half_inch_purchase', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(26, 'Solar Supplier Purchase', 'solar_supplier_purchase', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(27, 'Sprinkler Purchase', 'sprinkler_purchase', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(28, 'Technical Expense', 'technical_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(29, 'Office Supplies', 'office_supplies', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(30, 'Stationery', 'stationery', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(31, 'Network Excavation Expense', 'network_excavation_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(32, 'Damage Compensation', 'damage_compensation', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(33, 'Office Kitchen Expense', 'office_kitchen_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(34, 'Supplier Installment Payment', 'supplier_installment_payment', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(35, 'Other Expense', 'other_expense', 'expense', NULL, 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(36, 'Shareholder Distribution', 'shareholder_distribution', 'expense', NULL, 'active', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(37, 'Asset Purchase', 'asset_purchase', 'expense', 'Purchase of fixed infrastructure and technical assets.', 'active', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(38, 'Connection Fee Income', 'connection_fee_income', 'income', NULL, 'active', '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(39, 'Meter Fee Income', 'meter_fee_income', 'income', NULL, 'active', '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(40, 'Electricity Expense', 'electricity_expense', 'expense', NULL, 'active', '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(41, 'Maintenance Expense', 'maintenance_expense', 'expense', NULL, 'active', '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(42, 'Meter installation fee Income', 'meter_installation_fee', 'income', NULL, 'active', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(43, 'Customer Charge Income', 'customer_charge_income', 'income', NULL, 'active', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(44, 'Salary Advance', 'salary_advance', 'expense', NULL, 'active', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(45, 'Employee Final Settlement', 'employee_final_settlement', 'expense', NULL, 'active', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(46, 'Inventory Purchase', 'inventory_purchase', 'expense', NULL, 'active', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(47, 'Internal Material Usage', 'internal_material_usage', 'expense', NULL, 'active', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(48, 'Inventory Sale Income', 'inventory_sale_income', 'income', NULL, 'active', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(49, 'Cost of Goods Sold - Inventory', 'cogs_inventory', 'expense', NULL, 'active', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(50, 'Customer Payment Refunds', 'customer_payment_refund', 'expense', NULL, 'active', '2026-07-28 06:30:20', '2026-07-28 06:30:20');

-- --------------------------------------------------------

--
-- Table structure for table `financial_period_closings`
--

CREATE TABLE `financial_period_closings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `prepared_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `closed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reopened_by` bigint(20) UNSIGNED DEFAULT NULL,
  `period_code` varchar(255) NOT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `total_income` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_expense` decimal(16,2) NOT NULL DEFAULT 0.00,
  `payroll_expense` decimal(16,2) NOT NULL DEFAULT 0.00,
  `net_income` decimal(16,2) NOT NULL DEFAULT 0.00,
  `receivables` decimal(16,2) NOT NULL DEFAULT 0.00,
  `supplier_payables` decimal(16,2) NOT NULL DEFAULT 0.00,
  `cash_balance` decimal(16,2) NOT NULL DEFAULT 0.00,
  `bank_balance` decimal(16,2) NOT NULL DEFAULT 0.00,
  `distributable_profit` decimal(16,2) NOT NULL DEFAULT 0.00,
  `reconciliation_complete` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(255) NOT NULL DEFAULT 'draft',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `closed_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `reopened_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `reopen_reason` text DEFAULT NULL,
  `report_snapshot` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`report_snapshot`)),
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `financial_period_closings`
--

INSERT INTO `financial_period_closings` (`id`, `prepared_by`, `reviewed_by`, `closed_by`, `rejected_by`, `reopened_by`, `period_code`, `period_start`, `period_end`, `total_income`, `total_expense`, `payroll_expense`, `net_income`, `receivables`, `supplier_payables`, `cash_balance`, `bank_balance`, `distributable_profit`, `reconciliation_complete`, `status`, `submitted_at`, `reviewed_at`, `closed_at`, `rejected_at`, `reopened_at`, `rejection_reason`, `reopen_reason`, `report_snapshot`, `notes`, `created_at`, `updated_at`) VALUES
(1, 3, 2, 1, NULL, NULL, '2026-04', '2026-04-01', '2026-04-30', 300000.00, 20250.00, 10250.00, 279750.00, 2825.00, 0.00, 600000.00, 2114750.00, 279750.00, 1, 'closed', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, NULL, NULL, '{\"period_start\":\"2026-04-01\",\"period_end\":\"2026-04-30\",\"total_income\":300000,\"total_expense\":20250,\"payroll_expense\":10250,\"net_income\":279750,\"customer_deposits_received\":0,\"customer_deposits_refunded\":0,\"customer_payments_refunded\":0,\"customer_deposit_liability\":0,\"customer_deposits_requiring_refund\":0,\"receivables\":2825,\"supplier_payables\":0,\"cash_balance\":600000,\"bank_balance\":2114750,\"reconciliation_complete\":true}', 'Verified full-system demo month closing.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(2, 3, 2, 1, NULL, NULL, '2026-05', '2026-05-01', '2026-05-31', 320000.00, 19700.00, 11700.00, 300300.00, 2825.00, 0.00, 592000.00, 2423050.00, 300300.00, 1, 'closed', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, NULL, NULL, '{\"period_start\":\"2026-05-01\",\"period_end\":\"2026-05-31\",\"total_income\":320000,\"total_expense\":19700,\"payroll_expense\":11700,\"net_income\":300300,\"customer_deposits_received\":0,\"customer_deposits_refunded\":0,\"customer_payments_refunded\":0,\"customer_deposit_liability\":0,\"customer_deposits_requiring_refund\":0,\"receivables\":2825,\"supplier_payables\":0,\"cash_balance\":592000,\"bank_balance\":2423050,\"reconciliation_complete\":true}', 'Verified full-system demo month closing.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(3, 3, 2, 1, NULL, NULL, '2026-06', '2026-06-01', '2026-06-30', 450000.00, 124146.69, 117146.69, 325853.31, 2825.00, 0.00, 585000.00, 2755903.31, 325853.31, 1, 'closed', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, NULL, NULL, '{\"period_start\":\"2026-06-01\",\"period_end\":\"2026-06-30\",\"total_income\":450000,\"total_expense\":124146.69,\"payroll_expense\":117146.69,\"net_income\":325853.31,\"customer_deposits_received\":0,\"customer_deposits_refunded\":0,\"customer_payments_refunded\":0,\"customer_deposit_liability\":0,\"customer_deposits_requiring_refund\":0,\"receivables\":2825,\"supplier_payables\":0,\"cash_balance\":585000,\"bank_balance\":2755903.31,\"reconciliation_complete\":true}', 'Verified full-system demo month closing.', '2026-07-28 05:26:29', '2026-07-28 05:26:29');

-- --------------------------------------------------------

--
-- Table structure for table `goods`
--

CREATE TABLE `goods` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `category` enum('pipe','meter','chemical','fuel','solar','technical','office','other') NOT NULL,
  `unit` varchar(50) NOT NULL DEFAULT 'piece',
  `default_cost` decimal(16,2) NOT NULL DEFAULT 0.00,
  `default_price` decimal(16,2) NOT NULL DEFAULT 0.00,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `goods`
--

INSERT INTO `goods` (`id`, `name`, `code`, `category`, `unit`, `default_cost`, `default_price`, `status`, `description`, `created_at`, `updated_at`) VALUES
(1, 'PVC Pipe - Half Inch', 'PIPE-HALF-DEMO', 'pipe', 'meter', 50.00, 80.00, 'active', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 'Water Meter - Half Inch', 'METER-HALF-DEMO', 'meter', 'piece', 400.00, 600.00, 'active', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 'Half-inch Brass Valve', 'VALVE-HALF-DEMO', 'technical', 'piece', 30.00, 50.00, 'active', NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(4, 'Legacy Water Meter', 'METER-LEGACY', 'meter', 'piece', 0.00, 0.00, 'active', 'Opening-stock product used for meters registered before purchase tracking.', '2026-07-28 06:48:00', '2026-07-28 06:48:00');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_issues`
--

CREATE TABLE `inventory_issues` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `issue_number` varchar(255) NOT NULL,
  `issue_date` date NOT NULL,
  `type` enum('internal','customer') NOT NULL,
  `department_id` bigint(20) UNSIGNED DEFAULT NULL,
  `requested_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_contract_id` bigint(20) UNSIGNED DEFAULT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `invoice_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` enum('draft','pending_approval','approved','issued','cancelled') NOT NULL DEFAULT 'draft',
  `notes` text DEFAULT NULL,
  `total_cost` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_price` decimal(16,2) NOT NULL DEFAULT 0.00,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_issue_items`
--

CREATE TABLE `inventory_issue_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `inventory_issue_id` bigint(20) UNSIGNED NOT NULL,
  `inventory_item_id` bigint(20) UNSIGNED NOT NULL,
  `quantity` decimal(14,2) NOT NULL,
  `unit_cost` decimal(16,2) DEFAULT NULL,
  `unit_price` decimal(16,2) DEFAULT NULL,
  `total_cost` decimal(16,2) DEFAULT NULL,
  `total_price` decimal(16,2) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `inventory_items`
--

CREATE TABLE `inventory_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `good_id` bigint(20) UNSIGNED DEFAULT NULL,
  `warehouse_id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `category` enum('pipe','meter','chemical','fuel','solar','technical','office','other') NOT NULL,
  `unit` varchar(255) NOT NULL DEFAULT 'piece',
  `quantity` decimal(14,2) NOT NULL DEFAULT 0.00,
  `unit_cost` decimal(16,2) NOT NULL DEFAULT 0.00,
  `unit_price` decimal(16,2) NOT NULL DEFAULT 0.00,
  `reorder_level` decimal(14,2) NOT NULL DEFAULT 10.00,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_items`
--

INSERT INTO `inventory_items` (`id`, `good_id`, `warehouse_id`, `name`, `code`, `category`, `unit`, `quantity`, `unit_cost`, `unit_price`, `reorder_level`, `supplier_id`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 'PVC Pipe - Half Inch', 'PIPE-HALF-DEMO', 'pipe', 'meter', 18.00, 50.00, 80.00, 10.00, 1, NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 2, 2, 'Water Meter - Half Inch', 'METER-HALF-DEMO', 'meter', 'piece', 1.00, 400.00, 600.00, 10.00, 2, NULL, '2026-07-28 05:26:27', '2026-07-28 07:06:51'),
(3, 3, 3, 'Half-inch Brass Valve', 'VALVE-HALF-DEMO', 'technical', 'piece', 46.00, 30.00, 50.00, 10.00, 3, NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(4, 4, 1, 'Legacy Water Meter', 'METER-LEGACY-1', 'meter', 'piece', 1.00, 0.00, 0.00, 1.00, NULL, 'Serialized opening stock migrated from the original meter register.', '2026-07-28 06:48:00', '2026-07-28 06:48:00');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_requests`
--

CREATE TABLE `inventory_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `request_number` varchar(255) NOT NULL,
  `type` enum('purchase','issue') NOT NULL,
  `issue_type` enum('internal','customer') DEFAULT NULL,
  `status` enum('pending','approved','rejected','processed') NOT NULL DEFAULT 'pending',
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_id` bigint(20) UNSIGNED DEFAULT NULL,
  `department_id` bigint(20) UNSIGNED DEFAULT NULL,
  `warehouse_id` bigint(20) UNSIGNED DEFAULT NULL,
  `accounting_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_method_id` bigint(20) UNSIGNED DEFAULT NULL,
  `invoice_id` bigint(20) UNSIGNED DEFAULT NULL,
  `request_date` date NOT NULL,
  `notes` text DEFAULT NULL,
  `total_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `initial_payment_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_items` decimal(14,2) NOT NULL DEFAULT 0.00,
  `requested_by` bigint(20) UNSIGNED NOT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `approval_notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_requests`
--

INSERT INTO `inventory_requests` (`id`, `request_number`, `type`, `issue_type`, `status`, `supplier_id`, `customer_id`, `department_id`, `warehouse_id`, `accounting_account_id`, `payment_method_id`, `invoice_id`, `request_date`, `notes`, `total_amount`, `initial_payment_amount`, `total_items`, `requested_by`, `approved_by`, `approved_at`, `approval_notes`, `created_at`, `updated_at`) VALUES
(1, 'PO-20260728-00001', 'purchase', NULL, 'approved', 1, NULL, NULL, 1, 1, NULL, NULL, '2026-07-28', 'DEMO-INVENTORY:PURCHASE-PIPE', 1000.00, 0.00, 20.00, 1, 1, '2026-07-28 05:26:27', 'Approved demonstration workflow.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 'PO-20260728-00002', 'purchase', NULL, 'approved', 2, NULL, NULL, 2, 2, NULL, NULL, '2026-07-28', 'DEMO-INVENTORY:PURCHASE-METER', 1200.00, 0.00, 3.00, 1, 1, '2026-07-28 05:26:27', 'Approved demonstration workflow.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 'SI-20260728-00003', 'issue', 'internal', 'approved', NULL, NULL, 1, 1, NULL, NULL, NULL, '2026-07-28', 'DEMO-INVENTORY:INTERNAL-ISSUE', 100.00, 0.00, 2.00, 1, 1, '2026-07-28 05:26:27', 'Approved demonstration workflow.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(4, 'SI-20260728-00004', 'issue', 'customer', 'approved', NULL, 1, NULL, 2, 1, 1, 12, '2026-07-28', 'DEMO-INVENTORY:CUSTOMER-ISSUE', 600.00, 600.00, 1.00, 1, 1, '2026-07-28 05:26:27', 'Approved demonstration workflow.', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(5, 'PO-20260728-00005', 'purchase', NULL, 'approved', 3, NULL, NULL, 3, 1, NULL, NULL, '2026-07-23', 'FULL-DEMO:PURCHASE-VALVES', 1500.00, 0.00, 50.00, 8, 1, '2026-07-28 05:26:28', 'Approved demo purchase.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(6, 'SI-20260728-00006', 'issue', 'customer', 'approved', NULL, 3, NULL, 3, 1, 1, 13, '2026-07-24', 'FULL-DEMO:PARTIAL-CUSTOMER-ISSUE', 200.00, 80.00, 4.00, 8, 1, '2026-07-28 05:26:28', 'Approved partial-payment demo issue.', '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_request_items`
--

CREATE TABLE `inventory_request_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `inventory_request_id` bigint(20) UNSIGNED NOT NULL,
  `good_id` bigint(20) UNSIGNED DEFAULT NULL,
  `inventory_item_id` bigint(20) UNSIGNED DEFAULT NULL,
  `description` varchar(255) NOT NULL,
  `quantity` decimal(14,2) NOT NULL,
  `unit_price` decimal(16,2) NOT NULL,
  `total_price` decimal(16,2) NOT NULL,
  `meter_serials` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meter_serials`)),
  `meter_ids` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`meter_ids`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_request_items`
--

INSERT INTO `inventory_request_items` (`id`, `inventory_request_id`, `good_id`, `inventory_item_id`, `description`, `quantity`, `unit_price`, `total_price`, `meter_serials`, `meter_ids`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 1, 'PVC Pipe - Half Inch', 20.00, 50.00, 1000.00, NULL, NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 2, 2, 2, 'Water Meter - Half Inch', 3.00, 400.00, 1200.00, NULL, NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 3, 1, 1, 'PVC Pipe - Half Inch', 2.00, 50.00, 100.00, NULL, NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(4, 4, 2, 2, 'Water Meter - Half Inch', 1.00, 600.00, 600.00, NULL, NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(5, 5, 3, 3, 'Half-inch Brass Valve', 50.00, 30.00, 1500.00, NULL, NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(6, 6, 3, 3, 'Half-inch Brass Valve', 4.00, 50.00, 200.00, NULL, NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `inventory_transactions`
--

CREATE TABLE `inventory_transactions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `inventory_item_id` bigint(20) UNSIGNED NOT NULL,
  `type` enum('purchase','sale','internal_use','return','adjustment','transfer') NOT NULL,
  `quantity` decimal(14,2) NOT NULL DEFAULT 0.00,
  `unit_cost` decimal(16,2) DEFAULT NULL,
  `unit_price` decimal(16,2) DEFAULT NULL,
  `total_amount` decimal(16,2) DEFAULT NULL,
  `transaction_date` date NOT NULL,
  `reference_type` varchar(255) DEFAULT NULL,
  `reference_id` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `inventory_transactions`
--

INSERT INTO `inventory_transactions` (`id`, `inventory_item_id`, `type`, `quantity`, `unit_cost`, `unit_price`, `total_amount`, `transaction_date`, `reference_type`, `reference_id`, `notes`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'purchase', 20.00, 50.00, 80.00, 1000.00, '2026-07-28', 'App\\Models\\InventoryRequest', 1, 'PO-20260728-00001', 1, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 2, 'purchase', 3.00, 400.00, 600.00, 1200.00, '2026-07-28', 'App\\Models\\InventoryRequest', 2, 'PO-20260728-00002', 1, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 1, 'internal_use', -2.00, 50.00, 50.00, 100.00, '2026-07-28', 'App\\Models\\InventoryRequest', 3, 'SI-20260728-00003', 1, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(4, 2, 'sale', -1.00, 400.00, 600.00, 600.00, '2026-07-28', 'App\\Models\\InventoryRequest', 4, 'SI-20260728-00004', 1, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(5, 3, 'purchase', 50.00, 30.00, 50.00, 1500.00, '2026-07-23', 'App\\Models\\InventoryRequest', 5, 'PO-20260728-00005', 1, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(6, 3, 'sale', -4.00, 30.00, 50.00, 200.00, '2026-07-24', 'App\\Models\\InventoryRequest', 6, 'SI-20260728-00006', 1, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(7, 4, 'adjustment', 1.00, 0.00, 0.00, 0.00, '2026-07-28', 'App\\Models\\InventoryItem', 4, 'Opening balance for existing available meter serials.', NULL, '2026-07-28 06:48:00', '2026-07-28 06:48:00'),
(8, 2, 'internal_use', -1.00, 400.00, 600.00, 400.00, '2026-07-28', 'App\\Models\\MeterAssignment', 6, 'Meter STOCK-WH-FIELD-2-0001 installed for customer.', 1, '2026-07-28 07:06:51', '2026-07-28 07:06:51');

-- --------------------------------------------------------

--
-- Table structure for table `invoices`
--

CREATE TABLE `invoices` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `invoice_type` varchar(255) NOT NULL DEFAULT 'water',
  `billing_period_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `customer_contract_id` bigint(20) UNSIGNED DEFAULT NULL,
  `meter_reading_id` bigint(20) UNSIGNED DEFAULT NULL,
  `source_type` varchar(255) DEFAULT NULL,
  `source_id` bigint(20) UNSIGNED DEFAULT NULL,
  `invoice_number` varchar(255) NOT NULL,
  `issue_date` date NOT NULL,
  `due_date` date DEFAULT NULL,
  `previous_balance` decimal(14,2) NOT NULL DEFAULT 0.00,
  `consumption` decimal(14,2) NOT NULL DEFAULT 0.00,
  `rate_per_cubic_meter` decimal(12,2) NOT NULL DEFAULT 0.00,
  `water_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `penalty_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `total_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `remaining_amount` decimal(14,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'unpaid',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoices`
--

INSERT INTO `invoices` (`id`, `invoice_type`, `billing_period_id`, `customer_id`, `customer_contract_id`, `meter_reading_id`, `source_type`, `source_id`, `invoice_number`, `issue_date`, `due_date`, `previous_balance`, `consumption`, `rate_per_cubic_meter`, `water_amount`, `penalty_amount`, `discount_amount`, `total_amount`, `paid_amount`, `remaining_amount`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'contract', NULL, 1, 1, NULL, 'customer_contract', 1, 'INV-C-20260728-00001', '2026-07-28', '2026-08-12', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1500.00, 800.00, 700.00, 'partially_paid', 'Issued automatically after the customer contract was confirmed.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 'water', 4, 1, NULL, 1, 'meter_reading', 1, 'INV-W-20260728-00002', '2026-07-18', '2026-08-02', 1500.00, 12.00, 65.00, 780.00, 0.00, 0.00, 780.00, 500.00, 280.00, 'partially_paid', NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 'service', NULL, 1, NULL, NULL, 'customer_charge', 3, 'INV-S-20260728-00003', '2026-07-18', '2026-08-02', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 150.00, 150.00, 0.00, 'paid', 'TEST charge converted to a payable invoice automatically.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(4, 'contract', NULL, 2, 2, NULL, 'customer_contract', 2, 'INV-C-20260728-00004', '2026-07-28', '2026-08-12', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1200.00, 1200.00, 0.00, 'paid', 'Issued automatically after the customer contract was confirmed.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(5, 'water', 4, 2, NULL, 2, 'meter_reading', 2, 'INV-W-20260728-00005', '2026-07-18', '2026-08-02', 1200.00, 8.00, 65.00, 520.00, 0.00, 0.00, 520.00, 520.00, 0.00, 'paid', NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(6, 'service', NULL, 2, NULL, NULL, 'customer_charge', 6, 'INV-S-20260728-00006', '2026-07-18', '2026-08-02', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 250.00, 250.00, 0.00, 'paid', 'TEST charge converted to a payable invoice automatically.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(7, 'service', NULL, 2, NULL, NULL, 'customer_charge', 7, 'INV-S-20260728-00007', '2026-07-18', '2026-08-02', 0.00, 0.00, 0.00, 0.00, 100.00, 0.00, 100.00, 100.00, 0.00, 'paid', 'TEST disconnection workflow.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(8, 'service', NULL, 2, NULL, NULL, 'customer_charge', 8, 'INV-S-20260728-00008', '2026-07-18', '2026-08-02', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 200.00, 200.00, 0.00, 'paid', 'TEST reconnection workflow.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(9, 'contract', NULL, 3, 3, NULL, 'customer_contract', 3, 'INV-C-20260728-00009', '2026-07-28', '2026-08-12', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1800.00, 500.00, 1300.00, 'partially_paid', 'Issued automatically after the customer contract was confirmed.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(10, 'water', 4, 3, NULL, 3, 'meter_reading', 3, 'INV-W-20260728-00010', '2026-07-18', '2026-08-02', 1800.00, 5.00, 65.00, 325.00, 0.00, 0.00, 325.00, 0.00, 325.00, 'unpaid', NULL, '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(11, 'service', NULL, 3, NULL, NULL, 'customer_charge', 11, 'INV-S-20260728-00011', '2026-07-18', '2026-08-02', 0.00, 0.00, 0.00, 0.00, 100.00, 0.00, 100.00, 0.00, 100.00, 'unpaid', 'TEST disconnection workflow.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(12, 'inventory', NULL, 1, NULL, NULL, 'inventory_request', 4, 'INV-I-20260728-00012', '2026-07-28', '2026-07-28', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 600.00, 600.00, 0.00, 'paid', 'Inventory sale - SI-20260728-00004', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(13, 'inventory', NULL, 3, NULL, NULL, 'inventory_request', 6, 'INV-I-20260728-00013', '2026-07-24', '2026-07-24', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 200.00, 80.00, 120.00, 'partially_paid', 'Inventory sale - SI-20260728-00006', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(14, 'contract', NULL, 4, 4, NULL, 'customer_contract', 4, 'INV-C-20260728-00014', '2026-07-28', '2026-08-12', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 200.00, 0.00, 200.00, 'cancelled', 'Issued automatically after the customer contract was confirmed.', '2026-07-28 06:26:14', '2026-07-28 06:30:20'),
(15, 'contract', NULL, 4, 5, NULL, 'customer_contract', 5, 'INV-C-20260728-00015', '2026-07-28', '2026-08-12', 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 400.00, 400.00, 0.00, 'paid', 'Issued automatically after the customer contract was confirmed.', '2026-07-28 07:01:11', '2026-07-28 07:01:28'),
(16, 'water', 5, 4, NULL, 4, 'meter_reading', 4, 'INV-W-20260728-00016', '2026-08-01', '2026-08-31', 0.00, 2000.00, 65.00, 130000.00, 0.00, 0.00, 130000.00, 130000.00, 0.00, 'paid', NULL, '2026-07-28 07:09:31', '2026-07-28 07:10:33');

-- --------------------------------------------------------

--
-- Table structure for table `invoice_items`
--

CREATE TABLE `invoice_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `invoice_id` bigint(20) UNSIGNED NOT NULL,
  `customer_charge_id` bigint(20) UNSIGNED DEFAULT NULL,
  `financial_category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `item_type` varchar(255) NOT NULL DEFAULT 'service',
  `description` varchar(255) NOT NULL,
  `quantity` decimal(14,2) NOT NULL DEFAULT 1.00,
  `unit_price` decimal(16,2) NOT NULL DEFAULT 0.00,
  `discount_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `amount` decimal(16,2) NOT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `invoice_items`
--

INSERT INTO `invoice_items` (`id`, `invoice_id`, `customer_charge_id`, `financial_category_id`, `item_type`, `description`, `quantity`, `unit_price`, `discount_amount`, `amount`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 38, 'contract_fee', 'Connection fee', 1.00, 1000.00, 0.00, 1000.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 1, 2, 42, 'contract_fee', 'Meter installation fee', 1.00, 500.00, 0.00, 500.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 2, NULL, 1, 'water_usage', 'Water consumption', 12.00, 65.00, 0.00, 780.00, 'Current billing period usage only. Previous outstanding invoices remain separate.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(4, 3, 3, 43, 'service', 'TEST Leak inspection service', 1.00, 150.00, 0.00, 150.00, 'TEST charge converted to a payable invoice automatically.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(5, 4, 4, 38, 'contract_fee', 'Connection fee', 1.00, 800.00, 0.00, 800.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(6, 4, 5, 42, 'contract_fee', 'Meter installation fee', 1.00, 400.00, 0.00, 400.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(7, 5, NULL, 1, 'water_usage', 'Water consumption', 8.00, 65.00, 0.00, 520.00, 'Current billing period usage only. Previous outstanding invoices remain separate.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(8, 6, 6, 43, 'service', 'TEST New booklet service', 1.00, 250.00, 0.00, 250.00, 'TEST charge converted to a payable invoice automatically.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(9, 7, 7, NULL, 'penalty', 'Disconnection fee', 1.00, 100.00, 0.00, 100.00, 'TEST disconnection workflow.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(10, 8, 8, NULL, 'service', 'Reconnection fee', 1.00, 200.00, 0.00, 200.00, 'TEST reconnection workflow.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(11, 9, 9, 38, 'contract_fee', 'Connection fee', 1.00, 1200.00, 0.00, 1200.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(12, 9, 10, 42, 'contract_fee', 'Meter installation fee', 1.00, 600.00, 0.00, 600.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(13, 10, NULL, 1, 'water_usage', 'Water consumption', 5.00, 65.00, 0.00, 325.00, 'Current billing period usage only. Previous outstanding invoices remain separate.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(14, 11, 11, NULL, 'penalty', 'Disconnection fee', 1.00, 100.00, 0.00, 100.00, 'TEST disconnection workflow.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(15, 12, NULL, 48, 'inventory_sale', 'Water Meter - Half Inch', 1.00, 600.00, 0.00, 600.00, NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(16, 13, NULL, 48, 'inventory_sale', 'Half-inch Brass Valve', 4.00, 50.00, 0.00, 200.00, NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(17, 14, 12, 38, 'contract_fee', 'Connection fee', 1.00, 100.00, 0.00, 100.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 06:26:14', '2026-07-28 06:26:14'),
(18, 14, 13, 42, 'contract_fee', 'Meter installation fee', 1.00, 100.00, 0.00, 100.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 06:26:14', '2026-07-28 06:26:14'),
(19, 15, 14, 38, 'contract_fee', 'Connection fee', 1.00, 200.00, 0.00, 200.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 07:01:11', '2026-07-28 07:01:11'),
(20, 15, 15, 42, 'contract_fee', 'Meter installation fee', 1.00, 200.00, 0.00, 200.00, 'Created automatically when the customer contract was confirmed and invoiced.', '2026-07-28 07:01:11', '2026-07-28 07:01:11'),
(21, 16, NULL, 1, 'water_usage', 'Water consumption', 2000.00, 65.00, 0.00, 130000.00, 'Current billing period usage only. Previous outstanding invoices remain separate.', '2026-07-28 07:09:31', '2026-07-28 07:09:31');

-- --------------------------------------------------------

--
-- Table structure for table `jobs`
--

CREATE TABLE `jobs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `queue` varchar(255) NOT NULL,
  `payload` longtext NOT NULL,
  `attempts` tinyint(3) UNSIGNED NOT NULL,
  `reserved_at` int(10) UNSIGNED DEFAULT NULL,
  `available_at` int(10) UNSIGNED NOT NULL,
  `created_at` int(10) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_batches`
--

CREATE TABLE `job_batches` (
  `id` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `total_jobs` int(11) NOT NULL,
  `pending_jobs` int(11) NOT NULL,
  `failed_jobs` int(11) NOT NULL,
  `failed_job_ids` longtext NOT NULL,
  `options` mediumtext DEFAULT NULL,
  `cancelled_at` int(11) DEFAULT NULL,
  `created_at` int(11) NOT NULL,
  `finished_at` int(11) DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `job_positions`
--

CREATE TABLE `job_positions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `department_id` bigint(20) UNSIGNED DEFAULT NULL,
  `code` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `description` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `job_positions`
--

INSERT INTO `job_positions` (`id`, `department_id`, `code`, `title`, `description`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 'field_technician', 'Field Technician', NULL, 'active', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(2, 2, 'hr_officer', 'HR Officer', NULL, 'active', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(3, 3, 'accountant', 'Accountant', NULL, 'active', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(4, 4, 'operations_manager', 'Operations Manager', NULL, 'active', '2026-07-28 05:26:25', '2026-07-28 05:26:25');

-- --------------------------------------------------------

--
-- Table structure for table `leave_policies`
--

CREATE TABLE `leave_policies` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `days_per_year` decimal(6,2) NOT NULL DEFAULT 0.00,
  `is_paid` tinyint(1) NOT NULL DEFAULT 1,
  `tracks_balance` tinyint(1) NOT NULL DEFAULT 1,
  `carry_forward_limit` decimal(6,2) NOT NULL DEFAULT 0.00,
  `max_consecutive_days` decimal(6,2) DEFAULT NULL,
  `attachment_after_days` decimal(6,2) DEFAULT NULL,
  `payout_on_termination` tinyint(1) NOT NULL DEFAULT 0,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `leave_policies`
--

INSERT INTO `leave_policies` (`id`, `code`, `name`, `days_per_year`, `is_paid`, `tracks_balance`, `carry_forward_limit`, `max_consecutive_days`, `attachment_after_days`, `payout_on_termination`, `status`, `description`, `created_at`, `updated_at`) VALUES
(1, 'annual', 'Annual Leave', 20.00, 1, 1, 5.00, 15.00, NULL, 1, 'active', NULL, '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(2, 'sick', 'Sick Leave', 10.00, 1, 1, 0.00, NULL, 2.00, 0, 'active', NULL, '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(3, 'emergency', 'Emergency Leave', 5.00, 1, 1, 0.00, 3.00, NULL, 0, 'active', NULL, '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(4, 'unpaid', 'Unpaid Leave', 0.00, 0, 0, 0.00, NULL, NULL, 0, 'active', NULL, '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(5, 'other', 'Other Leave', 0.00, 0, 0, 0.00, NULL, NULL, 0, 'inactive', NULL, '2026-07-28 05:26:14', '2026-07-28 05:26:14');

-- --------------------------------------------------------

--
-- Table structure for table `leave_requests`
--

CREATE TABLE `leave_requests` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `leave_policy_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `leave_number` varchar(255) NOT NULL,
  `leave_type` varchar(255) NOT NULL,
  `start_date` date NOT NULL,
  `end_date` date NOT NULL,
  `total_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `is_paid` tinyint(1) NOT NULL DEFAULT 1,
  `reason` text NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `attachment_path` varchar(255) DEFAULT NULL,
  `attachment_original_name` varchar(255) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `leave_requests`
--

INSERT INTO `leave_requests` (`id`, `employee_id`, `leave_policy_id`, `created_by`, `reviewed_by`, `leave_number`, `leave_type`, `start_date`, `end_date`, `total_days`, `is_paid`, `reason`, `status`, `reviewed_at`, `rejection_reason`, `attachment_path`, `attachment_original_name`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 5, 2, 'LEV-20260728-00001', 'annual', '2026-06-10', '2026-06-11', 2.00, 1, 'Family appointment.', 'approved', '2026-07-01 04:30:00', NULL, NULL, NULL, '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(2, 3, 2, 3, NULL, 'LEV-20260728-00002', 'sick', '2026-07-21', '2026-07-22', 2.00, 1, 'Medical rest request awaiting manager decision.', 'pending', NULL, NULL, NULL, NULL, '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(3, 2, 3, 4, 2, 'LEV-20260728-00003', 'emergency', '2026-07-06', '2026-07-06', 1.00, 1, 'Personal emergency.', 'rejected', '2026-07-01 04:30:00', 'Required office coverage was not available.', NULL, NULL, '2026-07-28 05:26:25', '2026-07-28 05:26:25');

-- --------------------------------------------------------

--
-- Table structure for table `meters`
--

CREATE TABLE `meters` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `good_id` bigint(20) UNSIGNED DEFAULT NULL,
  `inventory_item_id` bigint(20) UNSIGNED DEFAULT NULL,
  `purchase_request_item_id` bigint(20) UNSIGNED DEFAULT NULL,
  `supplier_id` bigint(20) UNSIGNED DEFAULT NULL,
  `source_warehouse_id` bigint(20) UNSIGNED DEFAULT NULL,
  `current_warehouse_id` bigint(20) UNSIGNED DEFAULT NULL,
  `source_type` varchar(255) NOT NULL DEFAULT 'opening_stock',
  `purchase_cost` decimal(16,2) NOT NULL DEFAULT 0.00,
  `meter_number` varchar(255) NOT NULL,
  `type` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'available',
  `condition_notes` text DEFAULT NULL,
  `purchased_at` date DEFAULT NULL,
  `received_at` date DEFAULT NULL,
  `retired_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `meters`
--

INSERT INTO `meters` (`id`, `good_id`, `inventory_item_id`, `purchase_request_item_id`, `supplier_id`, `source_warehouse_id`, `current_warehouse_id`, `source_type`, `purchase_cost`, `meter_number`, `type`, `status`, `condition_notes`, `purchased_at`, `received_at`, `retired_at`, `created_at`, `updated_at`) VALUES
(1, 4, 4, NULL, NULL, 1, NULL, 'opening_stock', 0.00, 'TEST-MTR-0001', 'Mechanical', 'installed', 'TEST meter for the invoice-first workflow.', '2026-07-01', '2026-07-01', NULL, '2026-07-28 05:26:23', '2026-07-28 06:48:00'),
(2, 4, 4, NULL, NULL, 1, NULL, 'opening_stock', 0.00, 'TEST-MTR-0002-A', 'Mechanical', 'replaced', 'TEST meter for the invoice-first workflow.', '2026-07-01', '2026-07-01', NULL, '2026-07-28 05:26:23', '2026-07-28 06:48:00'),
(3, 4, 4, NULL, NULL, 1, NULL, 'opening_stock', 0.00, 'TEST-MTR-0002-B', 'Mechanical', 'installed', 'TEST meter for the invoice-first workflow.', '2026-07-01', '2026-07-01', NULL, '2026-07-28 05:26:23', '2026-07-28 06:48:00'),
(4, 4, 4, NULL, NULL, 1, NULL, 'opening_stock', 0.00, 'TEST-MTR-0003', 'Mechanical', 'installed', 'TEST meter for the invoice-first workflow.', '2026-07-01', '2026-07-01', NULL, '2026-07-28 05:26:24', '2026-07-28 06:48:00'),
(5, 4, 4, NULL, NULL, 1, 1, 'opening_stock', 0.00, 'TEST-MTR-0004', 'Digital', 'available', 'this is some', '2026-01-01', '2026-01-01', NULL, '2026-07-28 06:09:11', '2026-07-28 06:48:00'),
(6, 2, 2, 2, 2, 2, NULL, 'purchase', 400.00, 'STOCK-WH-FIELD-2-0001', 'Water Meter - Half Inch', 'installed', 'Opening-stock placeholder. Replace this number with the physical meter serial before assignment.', '2026-07-28', '2026-07-28', NULL, '2026-07-28 06:48:00', '2026-07-28 07:06:51'),
(7, 2, 2, 2, 2, 2, 2, 'purchase', 400.00, 'STOCK-WH-FIELD-2-0002', 'Water Meter - Half Inch', 'available', 'Opening-stock placeholder. Replace this number with the physical meter serial before assignment.', '2026-07-28', '2026-07-28', NULL, '2026-07-28 06:48:00', '2026-07-28 06:59:11');

-- --------------------------------------------------------

--
-- Table structure for table `meter_assignments`
--

CREATE TABLE `meter_assignments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `customer_contract_id` bigint(20) UNSIGNED DEFAULT NULL,
  `meter_id` bigint(20) UNSIGNED NOT NULL,
  `source_warehouse_id` bigint(20) UNSIGNED DEFAULT NULL,
  `return_warehouse_id` bigint(20) UNSIGNED DEFAULT NULL,
  `installed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `initial_reading` decimal(14,2) NOT NULL DEFAULT 0.00,
  `installation_date` date NOT NULL,
  `seal_number` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `removed_at` timestamp NULL DEFAULT NULL,
  `removal_disposition` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `meter_assignments`
--

INSERT INTO `meter_assignments` (`id`, `customer_id`, `customer_contract_id`, `meter_id`, `source_warehouse_id`, `return_warehouse_id`, `installed_by`, `initial_reading`, `installation_date`, `seal_number`, `status`, `removed_at`, `removal_disposition`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 1, NULL, NULL, 5, 0.00, '2026-07-18', 'TEST-SEAL-0001', 'active', NULL, NULL, NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 2, 2, 2, NULL, NULL, 5, 0.00, '2026-07-18', 'TEST-SEAL-0002-A', 'replaced', '2026-07-17 19:30:00', NULL, NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 2, 2, 3, NULL, NULL, 5, 0.00, '2026-07-18', 'TEST-SEAL-0002-B', 'active', NULL, NULL, NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(4, 3, 3, 4, NULL, NULL, 5, 0.00, '2026-07-18', 'TEST-SEAL-0003', 'active', NULL, NULL, NULL, '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(5, 4, 4, 5, NULL, NULL, 1, 0.00, '2026-07-28', 'GH3442332', 'removed', '2026-07-28 06:30:20', NULL, 'Removed because contract CTR-20260728-00004 was cancelled.', '2026-07-28 06:28:14', '2026-07-28 06:30:20'),
(6, 4, 5, 6, 2, NULL, 1, 0.00, '2026-07-28', 'SEAL_3424232', 'active', NULL, NULL, NULL, '2026-07-28 07:06:51', '2026-07-28 07:06:51');

-- --------------------------------------------------------

--
-- Table structure for table `meter_movements`
--

CREATE TABLE `meter_movements` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `meter_id` bigint(20) UNSIGNED NOT NULL,
  `type` varchar(50) NOT NULL,
  `from_warehouse_id` bigint(20) UNSIGNED DEFAULT NULL,
  `to_warehouse_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_id` bigint(20) UNSIGNED DEFAULT NULL,
  `meter_assignment_id` bigint(20) UNSIGNED DEFAULT NULL,
  `inventory_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `movement_date` datetime NOT NULL,
  `condition` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `meter_movements`
--

INSERT INTO `meter_movements` (`id`, `meter_id`, `type`, `from_warehouse_id`, `to_warehouse_id`, `customer_id`, `meter_assignment_id`, `inventory_transaction_id`, `movement_date`, `condition`, `notes`, `created_by`, `created_at`, `updated_at`) VALUES
(1, 1, 'opening_stock', NULL, 1, NULL, NULL, NULL, '2026-07-28 09:56:23', 'installed', 'Imported from the original meter register.', NULL, '2026-07-28 06:48:00', '2026-07-28 06:48:00'),
(2, 2, 'opening_stock', NULL, 1, NULL, NULL, NULL, '2026-07-28 09:56:23', 'replaced', 'Imported from the original meter register.', NULL, '2026-07-28 06:48:00', '2026-07-28 06:48:00'),
(3, 3, 'opening_stock', NULL, 1, NULL, NULL, NULL, '2026-07-28 09:56:23', 'installed', 'Imported from the original meter register.', NULL, '2026-07-28 06:48:00', '2026-07-28 06:48:00'),
(4, 4, 'opening_stock', NULL, 1, NULL, NULL, NULL, '2026-07-28 09:56:24', 'installed', 'Imported from the original meter register.', NULL, '2026-07-28 06:48:00', '2026-07-28 06:48:00'),
(5, 5, 'opening_stock', NULL, 1, NULL, NULL, NULL, '2026-07-28 10:39:11', 'available', 'Imported from the original meter register.', NULL, '2026-07-28 06:48:00', '2026-07-28 06:48:00'),
(6, 6, 'purchase_receipt', NULL, 2, NULL, NULL, NULL, '2026-07-28 11:18:00', 'available', 'Reconciled with historical purchase PO-20260728-00002; physical serial still requires verification.', NULL, '2026-07-28 06:48:00', '2026-07-28 06:59:11'),
(7, 7, 'purchase_receipt', NULL, 2, NULL, NULL, NULL, '2026-07-28 11:18:00', 'available', 'Reconciled with historical purchase PO-20260728-00002; physical serial still requires verification.', NULL, '2026-07-28 06:48:00', '2026-07-28 06:59:11'),
(8, 6, 'customer_installation', 2, NULL, 4, 6, 8, '2026-07-28 00:00:00', 'installed', 'Installed under assignment #6.', 1, '2026-07-28 07:06:51', '2026-07-28 07:06:51');

-- --------------------------------------------------------

--
-- Table structure for table `meter_readings`
--

CREATE TABLE `meter_readings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `billing_period_id` bigint(20) UNSIGNED NOT NULL,
  `meter_assignment_id` bigint(20) UNSIGNED NOT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `meter_id` bigint(20) UNSIGNED NOT NULL,
  `read_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reading_date` date NOT NULL,
  `previous_reading` decimal(14,2) NOT NULL,
  `current_reading` decimal(14,2) NOT NULL,
  `consumption` decimal(14,2) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'recorded',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `meter_readings`
--

INSERT INTO `meter_readings` (`id`, `billing_period_id`, `meter_assignment_id`, `customer_id`, `meter_id`, `read_by`, `reading_date`, `previous_reading`, `current_reading`, `consumption`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 4, 1, 1, 1, 6, '2026-07-18', 0.00, 12.00, 12.00, 'recorded', 'TEST reading recorded by the authenticated meter reader.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 4, 2, 2, 2, 6, '2026-07-18', 0.00, 8.00, 8.00, 'recorded', 'TEST reading recorded by the authenticated meter reader.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 4, 4, 3, 4, 6, '2026-07-18', 0.00, 5.00, 5.00, 'recorded', 'TEST reading recorded by the authenticated meter reader.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(4, 5, 6, 4, 6, 1, '2026-08-01', 0.00, 2000.00, 2000.00, 'recorded', 'fsfsfsfsf', '2026-07-28 07:09:31', '2026-07-28 07:09:31');

-- --------------------------------------------------------

--
-- Table structure for table `meter_seals`
--

CREATE TABLE `meter_seals` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `meter_assignment_id` bigint(20) UNSIGNED NOT NULL,
  `sealed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `removed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `seal_number` varchar(255) NOT NULL,
  `sealed_at` datetime NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'intact',
  `removed_at` datetime DEFAULT NULL,
  `removal_reason` text DEFAULT NULL,
  `photo_path` varchar(255) DEFAULT NULL,
  `photo_original_name` varchar(255) DEFAULT NULL,
  `photo_mime_type` varchar(255) DEFAULT NULL,
  `photo_size` bigint(20) UNSIGNED DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `meter_seals`
--

INSERT INTO `meter_seals` (`id`, `meter_assignment_id`, `sealed_by`, `removed_by`, `seal_number`, `sealed_at`, `status`, `removed_at`, `removal_reason`, `photo_path`, `photo_original_name`, `photo_mime_type`, `photo_size`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 5, NULL, 'TEST-SEAL-0001', '2026-07-18 00:00:00', 'intact', NULL, NULL, NULL, NULL, NULL, NULL, 'TEST seal recorded by the authenticated installer.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 2, 5, 5, 'TEST-SEAL-0002-A', '2026-07-18 00:00:00', 'replaced', '2026-07-18 00:00:00', 'Meter replaced by a new assignment.', NULL, NULL, NULL, NULL, 'TEST seal recorded by the authenticated installer.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 3, 5, NULL, 'TEST-SEAL-0002-B', '2026-07-18 00:00:00', 'intact', NULL, NULL, NULL, NULL, NULL, NULL, 'TEST seal recorded by the authenticated installer.', '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(4, 4, 5, NULL, 'TEST-SEAL-0003', '2026-07-18 00:00:00', 'intact', NULL, NULL, NULL, NULL, NULL, NULL, 'TEST seal recorded by the authenticated installer.', '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(5, 5, 1, 1, 'GH3442332', '2026-07-28 00:00:00', 'removed', '2026-07-28 11:00:20', 'Contract CTR-20260728-00004 cancelled: this is some description', 'meter-seals/5/d6697f11-3bb9-4637-9a67-836b1a40a215.png', 'New Project.png', 'image/png', 41920, NULL, '2026-07-28 06:28:14', '2026-07-28 06:30:20'),
(6, 6, 1, NULL, 'SEAL_3424232', '2026-07-28 00:00:00', 'intact', NULL, NULL, 'meter-seals/6/e2f0ffb5-c8cd-465b-9ad4-36477896e950.png', 'New Project.png', 'image/png', 41920, NULL, '2026-07-28 07:06:51', '2026-07-28 07:06:51');

-- --------------------------------------------------------

--
-- Table structure for table `migrations`
--

CREATE TABLE `migrations` (
  `id` int(10) UNSIGNED NOT NULL,
  `migration` varchar(255) NOT NULL,
  `batch` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `migrations`
--

INSERT INTO `migrations` (`id`, `migration`, `batch`) VALUES
(1, '0001_01_01_000000_create_users_table', 1),
(2, '0001_01_01_000001_create_cache_table', 1),
(3, '0001_01_01_000002_create_jobs_table', 1),
(4, '2026_06_10_110004_create_permission_tables', 1),
(5, '2026_06_10_110004_create_personal_access_tokens_table', 1),
(6, '2026_06_10_111000_add_profile_fields_to_users_table', 1),
(7, '2026_06_10_111100_create_phase_one_tables', 1),
(8, '2026_06_13_090000_create_phase_two_billing_tables', 1),
(9, '2026_06_14_130000_create_customer_documents_table', 1),
(10, '2026_06_15_090000_add_subscription_agreement_fields_to_customers_table', 1),
(11, '2026_06_15_100000_add_customer_agreement_approval_fields', 1),
(12, '2026_06_15_120000_create_accounting_and_supplier_tables', 1),
(13, '2026_06_15_130000_create_customer_operations_tables', 1),
(14, '2026_06_15_140000_add_accounting_account_to_payments_table', 1),
(15, '2026_06_16_090000_create_payment_allocations_and_charge_balances', 1),
(16, '2026_06_16_100000_add_ticket_workflow_fields_to_customer_service_requests', 1),
(17, '2026_07_13_000000_create_phase_four_financial_tables', 1),
(18, '2026_07_14_000000_add_agreement_payment_fields_to_customers_table', 1),
(19, '2026_07_15_000000_create_customer_contracts_and_deposits', 1),
(20, '2026_07_15_010000_add_customer_contract_permissions', 1),
(21, '2026_07_15_020000_add_customer_identity_uniqueness', 1),
(22, '2026_07_15_030000_create_meter_seals_table', 1),
(23, '2026_07_18_000000_add_last_name_to_customers_table', 1),
(24, '2026_07_18_010000_create_customer_charge_types_table', 1),
(25, '2026_07_18_020000_unify_customer_billing_with_invoice_items', 1),
(26, '2026_07_19_000000_add_contract_confirmation_workflow', 1),
(27, '2026_07_19_010000_create_notifications_table', 1),
(28, '2026_07_19_020000_reconcile_confirmed_customer_statuses', 1),
(29, '2026_07_19_030000_remove_customer_deposit_write_permissions', 1),
(30, '2026_07_19_040000_add_refund_audit_to_payments', 1),
(31, '2026_07_19_050000_add_refund_audit_to_payment_allocations', 1),
(32, '2026_07_20_000000_create_phase_six_hr_tables', 1),
(33, '2026_07_20_010000_complete_phase_six_hr', 1),
(34, '2026_07_22_000000_simplify_leave_settings', 1),
(35, '2026_07_22_010000_add_attendance_deductions_to_payroll', 1),
(36, '2026_07_23_000001_create_assets_table', 1),
(37, '2026_07_23_000002_create_inventory_tables', 1),
(38, '2026_07_23_000003_fix_inventory_transactions_nullable', 1),
(39, '2026_07_23_000004_add_financial_fields_to_inventory_issues', 1),
(40, '2026_07_23_000005_create_goods_table', 1),
(41, '2026_07_23_000006_create_inventory_requests_table', 1),
(42, '2026_07_26_000001_add_warehouse_id_to_inventory_requests', 1),
(43, '2026_07_26_000002_make_warehouse_nullable_in_inventory_items', 1),
(44, '2026_07_27_000000_harden_inventory_request_workflow', 1),
(45, '2026_07_27_010000_reconcile_legacy_inventory_request_statuses', 1),
(46, '2026_07_27_020000_normalize_inventory_transaction_references', 1),
(47, '2026_07_27_030000_add_payment_tracking_to_inventory_requests', 1),
(48, '2026_07_28_000000_create_asset_purchases_and_expense_management', 1),
(49, '2026_07_28_000000_link_serialized_meters_to_inventory', 2),
(50, '2026_07_28_000001_backfill_meter_purchase_provenance', 3);

-- --------------------------------------------------------

--
-- Table structure for table `model_has_permissions`
--

CREATE TABLE `model_has_permissions` (
  `permission_id` bigint(20) UNSIGNED NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `model_has_roles`
--

CREATE TABLE `model_has_roles` (
  `role_id` bigint(20) UNSIGNED NOT NULL,
  `model_type` varchar(255) NOT NULL,
  `model_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `model_has_roles`
--

INSERT INTO `model_has_roles` (`role_id`, `model_type`, `model_id`) VALUES
(1, 'App\\Models\\User', 1),
(2, 'App\\Models\\User', 2),
(3, 'App\\Models\\User', 3),
(4, 'App\\Models\\User', 4),
(5, 'App\\Models\\User', 6),
(6, 'App\\Models\\User', 7),
(7, 'App\\Models\\User', 8),
(8, 'App\\Models\\User', 5),
(8, 'App\\Models\\User', 10),
(9, 'App\\Models\\User', 9);

-- --------------------------------------------------------

--
-- Table structure for table `notifications`
--

CREATE TABLE `notifications` (
  `id` char(36) NOT NULL,
  `type` varchar(255) NOT NULL,
  `notifiable_type` varchar(255) NOT NULL,
  `notifiable_id` bigint(20) UNSIGNED NOT NULL,
  `data` text NOT NULL,
  `read_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `notifications`
--

INSERT INTO `notifications` (`id`, `type`, `notifiable_type`, `notifiable_id`, `data`, `read_at`, `created_at`, `updated_at`) VALUES
('07bc98a9-785f-4133-8352-0e378ac037db', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 2, '{\"event\":\"payroll_submitted\",\"title\":\"Payroll awaiting review\",\"message\":\"PAY-20260728-00002 is ready for review.\",\"href\":\"\\/dashboard\\/payroll\",\"payroll_run_id\":2}', NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
('0a936ef9-d16e-45b3-a12b-8dd5fd6a0d92', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 1, '{\"event\":\"payroll_reviewed\",\"title\":\"Payroll awaiting approval\",\"message\":\"PAY-20260728-00002 was reviewed and is ready for approval.\",\"href\":\"\\/dashboard\\/payroll\",\"payroll_run_id\":2}', '2026-07-28 05:40:42', '2026-07-28 05:26:28', '2026-07-28 05:40:42'),
('0c3d34d2-fbf8-4440-828a-fe087918c8f3', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 5, '{\"event\":\"leave_resolved\",\"title\":\"Leave approved\",\"message\":\"Your leave request LEV-20260728-00001 was approved.\",\"href\":\"\\/dashboard\\/attendance?tab=leave\",\"leave_request_id\":1}', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
('2c688ed5-fba9-4c6b-b1f3-689d95db0d88', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 10, '{\"event\":\"termination_approved\",\"title\":\"Final settlement approved\",\"message\":\"Your final settlement SET-DEMO-00001 was approved.\",\"href\":\"\\/dashboard\\/hr?tab=terminations\",\"employee_termination_id\":1}', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
('3e7b88d1-6a31-478e-bafe-0430feb9ce83', 'App\\Notifications\\CustomerContractConfirmedNotification', 'App\\Models\\User', 1, '{\"event\":\"customer_contract_confirmed\",\"title\":\"New customer contract confirmed\",\"message\":\"CTR-20260728-00001 for TEST Ahmad Rahimi was confirmed by WaterNet Demo Manager.\",\"href\":\"\\/dashboard\\/customers\\/1?tab=contract\",\"contract_id\":1,\"contract_number\":\"CTR-20260728-00001\",\"customer_id\":1,\"customer_name\":\"TEST Ahmad Rahimi\",\"confirmed_by_id\":2,\"confirmed_by_name\":\"WaterNet Demo Manager\"}', '2026-07-28 05:41:22', '2026-07-28 05:26:23', '2026-07-28 05:41:22'),
('3eb7f23d-9ff6-4887-8087-10407b6c5a61', 'App\\Notifications\\CustomerContractConfirmedNotification', 'App\\Models\\User', 1, '{\"event\":\"customer_contract_confirmed\",\"title\":\"New customer contract confirmed\",\"message\":\"CTR-20260728-00003 for TEST Mariam Azizi was confirmed by WaterNet Demo Manager.\",\"href\":\"\\/dashboard\\/customers\\/3?tab=contract\",\"contract_id\":3,\"contract_number\":\"CTR-20260728-00003\",\"customer_id\":3,\"customer_name\":\"TEST Mariam Azizi\",\"confirmed_by_id\":2,\"confirmed_by_name\":\"WaterNet Demo Manager\"}', '2026-07-28 05:40:57', '2026-07-28 05:26:24', '2026-07-28 05:40:57'),
('72c2d739-6287-4158-9fa0-a4a8120f8dd0', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 1, '{\"event\":\"payroll_reviewed\",\"title\":\"Payroll awaiting approval\",\"message\":\"PAY-20260728-00003 was reviewed and is ready for approval.\",\"href\":\"\\/dashboard\\/payroll\",\"payroll_run_id\":3}', '2026-07-28 05:40:49', '2026-07-28 05:26:28', '2026-07-28 05:40:49'),
('7876a4f4-c407-4f8f-8fef-9b775cf23a5c', 'App\\Notifications\\CustomerContractConfirmedNotification', 'App\\Models\\User', 1, '{\"event\":\"customer_contract_confirmed\",\"title\":\"New customer contract confirmed\",\"message\":\"CTR-20260728-00004 for samim khan was confirmed by WaterNet Demo Admin.\",\"href\":\"\\/dashboard\\/customers\\/4?tab=contract\",\"contract_id\":4,\"contract_number\":\"CTR-20260728-00004\",\"customer_id\":4,\"customer_name\":\"samim khan\",\"confirmed_by_id\":1,\"confirmed_by_name\":\"WaterNet Demo Admin\"}', '2026-07-28 06:26:36', '2026-07-28 06:26:14', '2026-07-28 06:26:36'),
('788d5b74-fd0c-4641-afb0-713d36bd7ad4', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 1, '{\"event\":\"payroll_submitted\",\"title\":\"Payroll awaiting review\",\"message\":\"PAY-20260728-00003 is ready for review.\",\"href\":\"\\/dashboard\\/payroll\",\"payroll_run_id\":3}', '2026-07-28 05:40:53', '2026-07-28 05:26:28', '2026-07-28 05:40:53'),
('7b8e34ef-3882-41e4-9bad-c1fb0611890a', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 2, '{\"event\":\"payroll_submitted\",\"title\":\"Payroll awaiting review\",\"message\":\"PAY-20260728-00003 is ready for review.\",\"href\":\"\\/dashboard\\/payroll\",\"payroll_run_id\":3}', NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
('7ce11941-f89f-4c6f-aefc-fa9dba1d02dd', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 2, '{\"event\":\"leave_submitted\",\"title\":\"Leave request awaiting review\",\"message\":\"Laila Rahimi submitted LEV-20260728-00002.\",\"href\":\"\\/dashboard\\/attendance?tab=leave\",\"leave_request_id\":2,\"employee_id\":3}', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
('7f98e53e-c940-4e80-99a5-0cfb1d78cb53', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 1, '{\"event\":\"payroll_submitted\",\"title\":\"Payroll awaiting review\",\"message\":\"PAY-20260728-00002 is ready for review.\",\"href\":\"\\/dashboard\\/payroll\",\"payroll_run_id\":2}', '2026-07-28 05:41:22', '2026-07-28 05:26:28', '2026-07-28 05:41:22'),
('a4553627-324e-45f4-8291-b7454c9ee2c7', 'App\\Notifications\\ServiceRequestAssignedNotification', 'App\\Models\\User', 5, '{\"event\":\"service_request_assigned\",\"title\":\"Service request assigned\",\"message\":\"SR-20260728-00002 for TEST Laila Noori was assigned to you by WaterNet Demo Manager.\",\"href\":\"\\/dashboard\\/customers\\/2?tab=requests\",\"service_request_id\":2,\"request_number\":\"SR-20260728-00002\",\"customer_id\":2,\"customer_name\":\"TEST Laila Noori\",\"assigned_by_id\":2,\"assigned_by_name\":\"WaterNet Demo Manager\"}', NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
('ac9c0c2e-d952-495b-86ad-d25973fd9b8f', 'App\\Notifications\\ServiceRequestAssignedNotification', 'App\\Models\\User', 5, '{\"event\":\"service_request_assigned\",\"title\":\"Service request assigned\",\"message\":\"SR-20260728-00001 for TEST Ahmad Rahimi was assigned to you by WaterNet Demo Manager.\",\"href\":\"\\/dashboard\\/customers\\/1?tab=requests\",\"service_request_id\":1,\"request_number\":\"SR-20260728-00001\",\"customer_id\":1,\"customer_name\":\"TEST Ahmad Rahimi\",\"assigned_by_id\":2,\"assigned_by_name\":\"WaterNet Demo Manager\"}', NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
('bb881542-eeb0-4293-a1d1-51907c53a9eb', 'App\\Notifications\\CustomerContractConfirmedNotification', 'App\\Models\\User', 1, '{\"event\":\"customer_contract_confirmed\",\"title\":\"New customer contract confirmed\",\"message\":\"CTR-20260728-00002 for TEST Laila Noori was confirmed by WaterNet Demo Manager.\",\"href\":\"\\/dashboard\\/customers\\/2?tab=contract\",\"contract_id\":2,\"contract_number\":\"CTR-20260728-00002\",\"customer_id\":2,\"customer_name\":\"TEST Laila Noori\",\"confirmed_by_id\":2,\"confirmed_by_name\":\"WaterNet Demo Manager\"}', '2026-07-28 05:41:02', '2026-07-28 05:26:23', '2026-07-28 05:41:02'),
('d296120f-8c2c-4d13-a9e1-a5b23d3f22cc', 'App\\Notifications\\CustomerContractConfirmedNotification', 'App\\Models\\User', 1, '{\"event\":\"customer_contract_confirmed\",\"title\":\"New customer contract confirmed\",\"message\":\"CTR-20260728-00005 for samim khan was confirmed by WaterNet Demo Admin.\",\"href\":\"\\/dashboard\\/customers\\/4?tab=contract\",\"contract_id\":5,\"contract_number\":\"CTR-20260728-00005\",\"customer_id\":4,\"customer_name\":\"samim khan\",\"confirmed_by_id\":1,\"confirmed_by_name\":\"WaterNet Demo Admin\"}', NULL, '2026-07-28 07:01:11', '2026-07-28 07:01:11'),
('e2e6c7ec-7ab1-421e-a2fa-36145a92d4da', 'App\\Notifications\\ServiceRequestAssignedNotification', 'App\\Models\\User', 5, '{\"event\":\"service_request_assigned\",\"title\":\"Service request assigned\",\"message\":\"SR-20260728-00003 for TEST Mariam Azizi was assigned to you by WaterNet Demo Manager.\",\"href\":\"\\/dashboard\\/customers\\/3?tab=requests\",\"service_request_id\":3,\"request_number\":\"SR-20260728-00003\",\"customer_id\":3,\"customer_name\":\"TEST Mariam Azizi\",\"assigned_by_id\":2,\"assigned_by_name\":\"WaterNet Demo Manager\"}', NULL, '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
('fd935116-3a85-4a75-aebb-7fb2b2d97bca', 'App\\Notifications\\HrWorkflowNotification', 'App\\Models\\User', 3, '{\"event\":\"payroll_paid\",\"title\":\"Salary paid\",\"message\":\"Payroll PAY-20260728-00001 was approved and paid.\",\"href\":\"\\/dashboard\\/payroll\",\"payroll_run_id\":1}', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `password_reset_tokens`
--

CREATE TABLE `password_reset_tokens` (
  `email` varchar(255) NOT NULL,
  `token` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payments`
--

CREATE TABLE `payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `invoice_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_id` bigint(20) UNSIGNED NOT NULL,
  `customer_contract_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_deposit_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_method_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `received_by` bigint(20) UNSIGNED DEFAULT NULL,
  `refunded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `refund_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `receipt_number` varchar(255) NOT NULL,
  `refund_receipt_number` varchar(255) DEFAULT NULL,
  `amount` decimal(14,2) NOT NULL,
  `refunded_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `paid_at` date NOT NULL,
  `refunded_at` date DEFAULT NULL,
  `reference` varchar(255) DEFAULT NULL,
  `refund_reference` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'posted',
  `notes` text DEFAULT NULL,
  `refund_reason` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payments`
--

INSERT INTO `payments` (`id`, `invoice_id`, `customer_id`, `customer_contract_id`, `customer_deposit_id`, `payment_method_id`, `accounting_account_id`, `received_by`, `refunded_by`, `refund_transaction_id`, `receipt_number`, `refund_receipt_number`, `amount`, `refunded_amount`, `paid_at`, `refunded_at`, `reference`, `refund_reference`, `status`, `notes`, `refund_reason`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 1, NULL, 1, 7, 7, NULL, NULL, 'RCT-20260728-00001', NULL, 1450.00, 0.00, '2026-07-18', NULL, 'TEST-PAY-0001', NULL, 'posted', 'One receipt allocated across contract, water, and service invoices.', NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(2, 4, 2, 2, NULL, 2, 8, 7, NULL, NULL, 'RCT-20260728-00002', NULL, 100.00, 0.00, '2026-07-18', NULL, 'TEST-CANCEL-0001', NULL, 'cancelled', 'TEST cancellation verifies invoice and account restoration.', NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(3, 4, 2, 2, NULL, 2, 8, 7, NULL, NULL, 'RCT-20260728-00003', NULL, 2270.00, 0.00, '2026-07-18', NULL, 'TEST-PAY-0002', NULL, 'posted', 'Full payment across all outstanding invoice types.', NULL, '2026-07-28 05:26:23', '2026-07-28 05:26:23'),
(4, 9, 3, 3, NULL, 1, 7, 7, NULL, NULL, 'RCT-20260728-00004', NULL, 500.00, 0.00, '2026-07-18', NULL, 'TEST-PAY-0003', NULL, 'posted', 'Partial contract payment leaves all other invoices outstanding.', NULL, '2026-07-28 05:26:24', '2026-07-28 05:26:24'),
(5, 12, 1, NULL, NULL, 1, 1, 1, NULL, NULL, 'RCT-20260728-00005', NULL, 600.00, 0.00, '2026-07-28', NULL, 'SI-20260728-00004', NULL, 'posted', 'DEMO-INVENTORY:CUSTOMER-ISSUE', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(6, 13, 3, NULL, NULL, 1, 1, 8, NULL, NULL, 'RCT-20260728-00006', NULL, 80.00, 0.00, '2026-07-24', NULL, 'SI-20260728-00006', NULL, 'posted', 'FULL-DEMO:PARTIAL-CUSTOMER-ISSUE', NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(7, 14, 4, 4, NULL, 1, 10, 1, 1, 39, 'RCT-20260728-00007', 'PRF-20260728-00001', 200.00, 200.00, '2026-07-28', '2026-07-28', NULL, '200', 'refunded', NULL, 'Contract CTR-20260728-00004 cancellation: this is some description', '2026-07-28 06:27:08', '2026-07-28 06:30:20'),
(8, 15, 4, 5, NULL, 1, 10, 1, NULL, NULL, 'RCT-20260728-00008', NULL, 400.00, 0.00, '2026-07-28', NULL, NULL, NULL, 'posted', NULL, NULL, '2026-07-28 07:01:28', '2026-07-28 07:01:28'),
(9, 16, 4, NULL, NULL, 1, 10, 1, NULL, NULL, 'RCT-20260728-00009', NULL, 130000.00, 0.00, '2026-07-28', NULL, NULL, NULL, 'posted', 'sfdfsdfsdf', NULL, '2026-07-28 07:10:33', '2026-07-28 07:10:33');

-- --------------------------------------------------------

--
-- Table structure for table `payment_allocations`
--

CREATE TABLE `payment_allocations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `payment_id` bigint(20) UNSIGNED NOT NULL,
  `invoice_id` bigint(20) UNSIGNED DEFAULT NULL,
  `customer_charge_id` bigint(20) UNSIGNED DEFAULT NULL,
  `amount` decimal(16,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL,
  `refunded_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `refunded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `refund_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `refunded_at` date DEFAULT NULL,
  `refund_receipt_number` varchar(255) DEFAULT NULL,
  `refund_reference` varchar(255) DEFAULT NULL,
  `refund_reason` text DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payment_allocations`
--

INSERT INTO `payment_allocations` (`id`, `payment_id`, `invoice_id`, `customer_charge_id`, `amount`, `created_at`, `updated_at`, `refunded_amount`, `refunded_by`, `refund_transaction_id`, `refunded_at`, `refund_receipt_number`, `refund_reference`, `refund_reason`) VALUES
(1, 1, 1, NULL, 800.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(2, 1, 2, NULL, 500.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(3, 1, 3, NULL, 150.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(4, 2, 4, NULL, 100.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(5, 3, 4, NULL, 1200.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(6, 3, 5, NULL, 520.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(7, 3, 6, NULL, 250.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(8, 3, 7, NULL, 100.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(9, 3, 8, NULL, 200.00, '2026-07-28 05:26:23', '2026-07-28 05:26:23', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(10, 4, 9, NULL, 500.00, '2026-07-28 05:26:24', '2026-07-28 05:26:24', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(11, 5, 12, NULL, 600.00, '2026-07-28 05:26:27', '2026-07-28 05:26:27', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(12, 6, 13, NULL, 80.00, '2026-07-28 05:26:28', '2026-07-28 05:26:28', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(13, 7, 14, NULL, 200.00, '2026-07-28 06:27:08', '2026-07-28 06:30:20', 200.00, 1, 39, '2026-07-28', 'PRF-20260728-00001', '200', 'Contract CTR-20260728-00004 cancellation: this is some description'),
(14, 8, 15, NULL, 400.00, '2026-07-28 07:01:28', '2026-07-28 07:01:28', 0.00, NULL, NULL, NULL, NULL, NULL, NULL),
(15, 9, 16, NULL, 130000.00, '2026-07-28 07:10:33', '2026-07-28 07:10:33', 0.00, NULL, NULL, NULL, NULL, NULL, NULL);

-- --------------------------------------------------------

--
-- Table structure for table `payment_methods`
--

CREATE TABLE `payment_methods` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payment_methods`
--

INSERT INTO `payment_methods` (`id`, `name`, `code`, `status`, `created_at`, `updated_at`) VALUES
(1, 'Cash', 'cash', 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(2, 'Bank Transfer', 'bank_transfer', 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(3, 'Mobile Money', 'mobile_money', 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(4, 'Check', 'check', 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03'),
(5, 'Online Payment', 'online_payment', 'active', '2026-07-28 05:26:03', '2026-07-28 05:26:03');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_advance_allocations`
--

CREATE TABLE `payroll_advance_allocations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `payroll_item_id` bigint(20) UNSIGNED NOT NULL,
  `salary_advance_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `payroll_deduction_allocations`
--

CREATE TABLE `payroll_deduction_allocations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `payroll_item_id` bigint(20) UNSIGNED NOT NULL,
  `employee_payroll_deduction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payroll_deduction_rule_id` bigint(20) UNSIGNED DEFAULT NULL,
  `code` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL,
  `calculation_type` varchar(255) NOT NULL,
  `value_snapshot` decimal(16,4) NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payroll_deduction_allocations`
--

INSERT INTO `payroll_deduction_allocations` (`id`, `payroll_item_id`, `employee_payroll_deduction_id`, `payroll_deduction_rule_id`, `code`, `name`, `type`, `calculation_type`, `value_snapshot`, `amount`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 1, 'income_tax_demo', 'Income Tax', 'tax', 'percentage', 5.0000, 420.62, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(2, 1, 6, 2, 'health_insurance_demo', 'Health Insurance', 'insurance', 'fixed', 300.0000, 300.00, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(3, 2, 2, 1, 'income_tax_demo', 'Income Tax', 'tax', 'percentage', 5.0000, 800.00, '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(4, 3, 3, 1, 'income_tax_demo', 'Income Tax', 'tax', 'percentage', 5.0000, 675.00, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(5, 3, 7, 2, 'health_insurance_demo', 'Health Insurance', 'insurance', 'fixed', 300.0000, 300.00, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(6, 4, 4, 1, 'income_tax_demo', 'Income Tax', 'tax', 'percentage', 5.0000, 1000.00, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(7, 5, 5, 1, 'income_tax_demo', 'Income Tax', 'tax', 'percentage', 5.0000, 670.00, '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_deduction_rules`
--

CREATE TABLE `payroll_deduction_rules` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `type` varchar(255) NOT NULL DEFAULT 'other',
  `calculation_type` varchar(255) NOT NULL DEFAULT 'fixed',
  `value` decimal(16,4) NOT NULL DEFAULT 0.0000,
  `threshold_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `maximum_amount` decimal(16,2) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `description` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payroll_deduction_rules`
--

INSERT INTO `payroll_deduction_rules` (`id`, `code`, `name`, `type`, `calculation_type`, `value`, `threshold_amount`, `maximum_amount`, `status`, `description`, `created_at`, `updated_at`) VALUES
(1, 'income_tax_demo', 'Income Tax', 'tax', 'percentage', 5.0000, 10000.00, 1500.00, 'active', 'Five percent of eligible salary above AFN 10,000.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(2, 'health_insurance_demo', 'Health Insurance', 'insurance', 'fixed', 300.0000, 0.00, NULL, 'active', 'Fixed monthly employee contribution.', '2026-07-28 05:26:26', '2026-07-28 05:26:26'),
(3, 'staff_welfare_demo', 'Staff Welfare Contribution', 'other', 'fixed', 100.0000, 0.00, NULL, 'active', 'Optional recurring demo deduction.', '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_items`
--

CREATE TABLE `payroll_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `payroll_run_id` bigint(20) UNSIGNED NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `employee_id` bigint(20) UNSIGNED DEFAULT NULL,
  `employee_name` varchar(255) NOT NULL,
  `salary_type` varchar(255) NOT NULL DEFAULT 'fixed',
  `contracted_salary` decimal(16,2) NOT NULL DEFAULT 0.00,
  `base_salary` decimal(16,2) NOT NULL DEFAULT 0.00,
  `scheduled_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `present_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `paid_leave_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `absent_days` decimal(6,2) NOT NULL DEFAULT 0.00,
  `late_minutes` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `overtime_hours` decimal(8,2) NOT NULL DEFAULT 0.00,
  `bonus` decimal(16,2) NOT NULL DEFAULT 0.00,
  `overtime_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `absence_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `late_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `advance_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `tax_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `recurring_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `other_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `net_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `payment_status` varchar(255) NOT NULL DEFAULT 'pending',
  `paid_at` timestamp NULL DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payroll_items`
--

INSERT INTO `payroll_items` (`id`, `payroll_run_id`, `user_id`, `employee_id`, `employee_name`, `salary_type`, `contracted_salary`, `base_salary`, `scheduled_days`, `present_days`, `paid_leave_days`, `absent_days`, `late_minutes`, `overtime_hours`, `bonus`, `overtime_amount`, `absence_deduction`, `late_deduction`, `advance_deduction`, `tax_deduction`, `recurring_deduction`, `other_deduction`, `net_amount`, `payment_status`, `paid_at`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 5, 1, 'Ahmad Karimi', 'attendance', 18000.00, 18000.00, 26.00, 22.00, 3.00, 1.00, 10, 1.00, 1000.00, 120.00, 692.31, 15.38, 0.00, 420.62, 300.00, 0.00, 17691.69, 'paid', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:27'),
(2, 1, 4, 2, 'Maryam Habibi', 'fixed', 26000.00, 26000.00, 26.00, 25.00, 1.00, 0.00, 0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 800.00, 0.00, 0.00, 25200.00, 'paid', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:26', '2026-07-28 05:26:27'),
(3, 1, 3, 3, 'Laila Rahimi', 'fixed', 24000.00, 24000.00, 26.00, 25.00, 1.00, 0.00, 0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 675.00, 300.00, 500.00, 22525.00, 'paid', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(4, 1, 2, 4, 'Nadia Safi', 'fixed', 30000.00, 30000.00, 26.00, 25.00, 1.00, 0.00, 0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 1000.00, 0.00, 0.00, 29000.00, 'paid', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(5, 1, 10, 5, 'Farid Safi', 'daily', 23400.00, 23400.00, 26.00, 25.00, 1.00, 0.00, 0, 0.00, 0.00, 0.00, 0.00, 0.00, 0.00, 670.00, 0.00, 0.00, 22730.00, 'paid', '2026-07-28 05:26:27', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(6, 2, 5, NULL, 'Ahmad Karimi', 'fixed', 0.00, 10000.00, 0.00, 0.00, 0.00, 0.00, 0, 0.00, 500.00, 0.00, 250.00, 0.00, 0.00, 0.00, 0.00, 0.00, 10250.00, 'paid', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(7, 3, 4, NULL, 'Maryam Habibi', 'fixed', 0.00, 12000.00, 0.00, 0.00, 0.00, 0.00, 0, 0.00, 0.00, 0.00, 300.00, 0.00, 0.00, 0.00, 0.00, 0.00, 11700.00, 'paid', '2026-07-28 05:26:28', NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `payroll_runs`
--

CREATE TABLE `payroll_runs` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `accounting_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_method_id` bigint(20) UNSIGNED DEFAULT NULL,
  `financial_category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `payroll_number` varchar(255) NOT NULL,
  `title` varchar(255) NOT NULL,
  `generated_from_hr` tinyint(1) NOT NULL DEFAULT 0,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `payment_date` date NOT NULL,
  `total_base_salary` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_bonus` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_overtime` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_absence_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_late_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_advance_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_tax_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_recurring_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_other_deduction` decimal(16,2) NOT NULL DEFAULT 0.00,
  `total_net` decimal(16,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'draft',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `payroll_runs`
--

INSERT INTO `payroll_runs` (`id`, `accounting_account_id`, `payment_method_id`, `financial_category_id`, `accounting_transaction_id`, `created_by`, `reviewed_by`, `approved_by`, `rejected_by`, `payroll_number`, `title`, `generated_from_hr`, `period_start`, `period_end`, `payment_date`, `total_base_salary`, `total_bonus`, `total_overtime`, `total_absence_deduction`, `total_late_deduction`, `total_advance_deduction`, `total_tax_deduction`, `total_recurring_deduction`, `total_other_deduction`, `total_net`, `status`, `submitted_at`, `reviewed_at`, `approved_at`, `rejected_at`, `rejection_reason`, `notes`, `created_at`, `updated_at`) VALUES
(1, 9, 2, 12, 12, 4, 2, 1, NULL, 'PAY-20260728-00001', 'June 2026 Payroll', 1, '2026-06-01', '2026-06-30', '2026-06-30', 121400.00, 1000.00, 120.00, 692.31, 15.38, 0.00, 3565.62, 600.00, 500.00, 117146.69, 'approved', '2026-06-29 04:30:00', '2026-07-28 05:26:27', '2026-07-28 05:26:27', NULL, NULL, 'Approved demo payroll generated from attendance, leave, overtime, bonuses, tax, and recurring deductions.', '2026-07-28 05:26:26', '2026-07-28 05:26:27'),
(2, 9, 2, 12, 26, 3, 2, 1, NULL, 'PAY-20260728-00002', 'April 2026 Demo Payroll', 0, '2026-04-01', '2026-04-30', '2026-04-30', 10000.00, 500.00, 0.00, 250.00, 0.00, 0.00, 0.00, 0.00, 0.00, 10250.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Approved historical payroll for full-system report coverage.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(3, 9, 2, 12, 27, 3, 2, 1, NULL, 'PAY-20260728-00003', 'May 2026 Demo Payroll', 0, '2026-05-01', '2026-05-31', '2026-05-31', 12000.00, 0.00, 0.00, 300.00, 0.00, 0.00, 0.00, 0.00, 0.00, 11700.00, 'approved', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Approved historical payroll for full-system report coverage.', '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `performance_reviews`
--

CREATE TABLE `performance_reviews` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `period_start` date NOT NULL,
  `period_end` date NOT NULL,
  `rating` tinyint(3) UNSIGNED NOT NULL,
  `achievements` text DEFAULT NULL,
  `concerns` text DEFAULT NULL,
  `goals` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'draft',
  `finalized_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `performance_reviews`
--

INSERT INTO `performance_reviews` (`id`, `employee_id`, `reviewed_by`, `period_start`, `period_end`, `rating`, `achievements`, `concerns`, `goals`, `notes`, `status`, `finalized_at`, `created_at`, `updated_at`) VALUES
(1, 1, 2, '2026-04-01', '2026-06-30', 4, 'Completed emergency pipe repairs and maintained good attendance.', NULL, 'Complete advanced meter installation training.', NULL, 'finalized', '2026-07-02 05:30:00', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 2, 2, '2026-01-01', '2026-03-31', 5, 'Completed assigned operational targets.', NULL, 'Improve documentation and response time.', NULL, 'finalized', '2026-04-02 04:30:00', '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 3, 2, '2026-04-01', '2026-06-30', 3, 'Completed assigned operational targets.', NULL, 'Improve documentation and response time.', NULL, 'draft', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `permissions`
--

CREATE TABLE `permissions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `permissions`
--

INSERT INTO `permissions` (`id`, `name`, `guard_name`, `created_at`, `updated_at`) VALUES
(1, 'finance-transactions.view', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(2, 'finance-transactions.create', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(3, 'finance-transactions.update', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(4, 'finance-transactions.delete', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(5, 'payroll.view', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(6, 'payroll.create', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(7, 'payroll.update', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(8, 'payroll.delete', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(9, 'shareholders.view', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(10, 'shareholders.create', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(11, 'shareholders.update', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(12, 'shareholders.delete', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(13, 'reconciliation.view', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(14, 'reconciliation.create', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(15, 'reconciliation.update', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(16, 'reconciliation.delete', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(17, 'financial-closing.view', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(18, 'financial-closing.create', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(19, 'financial-closing.update', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(20, 'financial-closing.delete', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(21, 'financial-reports.view', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(22, 'financial-reports.create', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(23, 'financial-reports.update', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(24, 'financial-reports.delete', 'web', '2026-07-28 05:26:06', '2026-07-28 05:26:06'),
(25, 'customer-contracts.view', 'web', '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(26, 'customer-contracts.create', 'web', '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(27, 'customer-contracts.update', 'web', '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(28, 'customer-contracts.delete', 'web', '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(29, 'customer-deposits.view', 'web', '2026-07-28 05:26:08', '2026-07-28 05:26:08'),
(33, 'employees.view', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(34, 'employees.create', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(35, 'employees.update', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(36, 'employees.delete', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(37, 'attendance.view', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(38, 'attendance.create', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(39, 'attendance.update', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(40, 'attendance.delete', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(41, 'leave-requests.view', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(42, 'leave-requests.create', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(43, 'leave-requests.update', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(44, 'leave-requests.delete', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(45, 'salary-advances.view', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(46, 'salary-advances.create', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(47, 'salary-advances.update', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(48, 'salary-advances.delete', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(49, 'employee-adjustments.view', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(50, 'employee-adjustments.create', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(51, 'employee-adjustments.update', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(52, 'employee-adjustments.delete', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(53, 'performance-reviews.view', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(54, 'performance-reviews.create', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(55, 'performance-reviews.update', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(56, 'performance-reviews.delete', 'web', '2026-07-28 05:26:12', '2026-07-28 05:26:12'),
(57, 'leave-policies.view', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(58, 'leave-policies.create', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(59, 'leave-policies.update', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(60, 'leave-policies.delete', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(61, 'work-schedules.view', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(62, 'work-schedules.create', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(63, 'work-schedules.update', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(64, 'work-schedules.delete', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(65, 'payroll-deductions.view', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(66, 'payroll-deductions.create', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(67, 'payroll-deductions.update', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(68, 'payroll-deductions.delete', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(69, 'employee-terminations.view', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(70, 'employee-terminations.create', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(71, 'employee-terminations.update', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(72, 'employee-terminations.delete', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(73, 'biometric-imports.view', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(74, 'biometric-imports.create', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(75, 'biometric-imports.update', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(76, 'biometric-imports.delete', 'web', '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(77, 'dashboard.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(78, 'dashboard.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(79, 'dashboard.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(80, 'dashboard.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(81, 'users.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(82, 'users.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(83, 'users.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(84, 'users.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(85, 'roles.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(86, 'roles.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(87, 'roles.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(88, 'roles.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(89, 'settings.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(90, 'settings.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(91, 'settings.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(92, 'settings.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(93, 'service-areas.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(94, 'service-areas.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(95, 'service-areas.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(96, 'service-areas.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(97, 'customers.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(98, 'customers.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(99, 'customers.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(100, 'customers.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(101, 'customer-deposits.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(102, 'customer-deposits.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(103, 'customer-deposits.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(104, 'meters.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(105, 'meters.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(106, 'meters.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(107, 'meters.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(108, 'meter-assignments.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(109, 'meter-assignments.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(110, 'meter-assignments.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(111, 'meter-assignments.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(112, 'billing-periods.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(113, 'billing-periods.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(114, 'billing-periods.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(115, 'billing-periods.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(116, 'meter-readings.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(117, 'meter-readings.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(118, 'meter-readings.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(119, 'meter-readings.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(120, 'invoices.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(121, 'invoices.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(122, 'invoices.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(123, 'invoices.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(124, 'payments.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(125, 'payments.create', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(126, 'payments.update', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(127, 'payments.delete', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(128, 'accounting.view', 'web', '2026-07-28 05:26:18', '2026-07-28 05:26:18'),
(129, 'accounting.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(130, 'accounting.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(131, 'accounting.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(132, 'expenses.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(133, 'expenses.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(134, 'expenses.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(135, 'expenses.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(136, 'expense-types.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(137, 'expense-types.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(138, 'expense-types.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(139, 'expense-types.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(140, 'suppliers.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(141, 'suppliers.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(142, 'suppliers.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(143, 'suppliers.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(144, 'assets.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(145, 'assets.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(146, 'assets.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(147, 'assets.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(148, 'asset-purchases.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(149, 'asset-purchases.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(150, 'asset-purchases.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(151, 'asset-purchases.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(152, 'warehouses.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(153, 'warehouses.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(154, 'warehouses.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(155, 'warehouses.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(156, 'inventory.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(157, 'inventory.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(158, 'inventory.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(159, 'inventory.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(160, 'goods.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(161, 'goods.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(162, 'goods.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(163, 'goods.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(164, 'reports.view', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(165, 'reports.create', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(166, 'reports.update', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(167, 'reports.delete', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(168, 'supplier-contracts.view', 'web', '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(169, 'supplier-contracts.create', 'web', '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(170, 'supplier-contracts.update', 'web', '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(171, 'supplier-contracts.delete', 'web', '2026-07-28 05:26:21', '2026-07-28 05:26:21');

-- --------------------------------------------------------

--
-- Table structure for table `personal_access_tokens`
--

CREATE TABLE `personal_access_tokens` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `tokenable_type` varchar(255) NOT NULL,
  `tokenable_id` bigint(20) UNSIGNED NOT NULL,
  `name` text NOT NULL,
  `token` varchar(64) NOT NULL,
  `abilities` text DEFAULT NULL,
  `last_used_at` timestamp NULL DEFAULT NULL,
  `expires_at` timestamp NULL DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `personal_access_tokens`
--

INSERT INTO `personal_access_tokens` (`id`, `tokenable_type`, `tokenable_id`, `name`, `token`, `abilities`, `last_used_at`, `expires_at`, `created_at`, `updated_at`) VALUES
(4, 'App\\Models\\User', 1, 'frontend', '205b9966b48dced2e37439e3feb13d844034c982ce2dd88284c6d96fc3a9d69a', '[\"*\"]', '2026-07-28 07:12:13', NULL, '2026-07-28 05:33:23', '2026-07-28 07:12:13'),
(5, 'App\\Models\\User', 1, 'frontend', 'f271b754b087943911cc6cb67bbb69d38448d94a91de30632ef448444c3e00c6', '[\"*\"]', '2026-07-29 00:27:53', NULL, '2026-07-29 00:05:53', '2026-07-29 00:27:53'),
(6, 'App\\Models\\User', 1, 'frontend', 'c71db75ca259255721ce451d47740ff193897eeae7fce9cf6aa2216bb3d7f437', '[\"*\"]', '2026-07-29 00:37:40', NULL, '2026-07-29 00:28:14', '2026-07-29 00:37:40');

-- --------------------------------------------------------

--
-- Table structure for table `public_holidays`
--

CREATE TABLE `public_holidays` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `holiday_date` date NOT NULL,
  `name` varchar(255) NOT NULL,
  `is_paid` tinyint(1) NOT NULL DEFAULT 1,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `public_holidays`
--

INSERT INTO `public_holidays` (`id`, `holiday_date`, `name`, `is_paid`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, '2026-06-18', 'Demo Paid Public Holiday', 1, 'active', 'Included as a paid day in June payroll.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(2, '2026-07-14', 'Demo Unpaid Company Holiday', 0, 'active', 'Excluded from paid days in final settlement.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(3, '2026-08-19', 'Independence Day', 1, 'active', 'Third public holiday demo record.', '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `roles`
--

CREATE TABLE `roles` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `guard_name` varchar(255) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `roles`
--

INSERT INTO `roles` (`id`, `name`, `guard_name`, `created_at`, `updated_at`) VALUES
(1, 'Admin', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(2, 'Manager', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(3, 'Accountant', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(4, 'HR', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(5, 'Meter Reader', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(6, 'Collector', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(7, 'Warehouse Officer', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(8, 'Technician', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19'),
(9, 'Viewer', 'web', '2026-07-28 05:26:19', '2026-07-28 05:26:19');

-- --------------------------------------------------------

--
-- Table structure for table `role_has_permissions`
--

CREATE TABLE `role_has_permissions` (
  `permission_id` bigint(20) UNSIGNED NOT NULL,
  `role_id` bigint(20) UNSIGNED NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `role_has_permissions`
--

INSERT INTO `role_has_permissions` (`permission_id`, `role_id`) VALUES
(1, 1),
(1, 2),
(1, 3),
(2, 1),
(2, 2),
(2, 3),
(3, 1),
(3, 2),
(3, 3),
(4, 1),
(4, 2),
(4, 3),
(5, 1),
(5, 2),
(5, 3),
(5, 4),
(6, 1),
(6, 2),
(6, 3),
(6, 4),
(7, 1),
(7, 2),
(7, 3),
(7, 4),
(8, 1),
(8, 2),
(8, 3),
(8, 4),
(9, 1),
(9, 2),
(9, 3),
(10, 1),
(10, 2),
(10, 3),
(11, 1),
(11, 2),
(11, 3),
(12, 1),
(12, 2),
(12, 3),
(13, 1),
(13, 2),
(13, 3),
(14, 1),
(14, 2),
(14, 3),
(15, 1),
(15, 2),
(15, 3),
(16, 1),
(16, 2),
(16, 3),
(17, 1),
(17, 2),
(17, 3),
(18, 1),
(18, 2),
(18, 3),
(19, 1),
(19, 2),
(19, 3),
(20, 1),
(20, 2),
(20, 3),
(21, 1),
(21, 2),
(21, 3),
(22, 1),
(22, 2),
(22, 3),
(23, 1),
(23, 2),
(23, 3),
(24, 1),
(24, 2),
(24, 3),
(25, 1),
(25, 2),
(25, 3),
(25, 6),
(26, 1),
(26, 2),
(26, 3),
(26, 6),
(27, 1),
(27, 2),
(27, 3),
(27, 6),
(28, 1),
(28, 2),
(28, 3),
(28, 6),
(29, 1),
(29, 2),
(29, 3),
(29, 6),
(33, 1),
(33, 2),
(33, 4),
(34, 1),
(34, 2),
(34, 4),
(35, 1),
(35, 2),
(35, 4),
(36, 1),
(36, 2),
(36, 4),
(37, 1),
(37, 2),
(37, 4),
(38, 1),
(38, 2),
(38, 4),
(39, 1),
(39, 2),
(39, 4),
(40, 1),
(40, 2),
(40, 4),
(41, 1),
(41, 2),
(41, 4),
(42, 1),
(42, 2),
(42, 4),
(43, 1),
(43, 2),
(43, 4),
(44, 1),
(44, 2),
(44, 4),
(45, 1),
(45, 2),
(45, 3),
(45, 4),
(46, 1),
(46, 2),
(46, 3),
(46, 4),
(47, 1),
(47, 2),
(47, 3),
(47, 4),
(48, 1),
(48, 2),
(48, 3),
(48, 4),
(49, 1),
(49, 2),
(49, 4),
(50, 1),
(50, 2),
(50, 4),
(51, 1),
(51, 2),
(51, 4),
(52, 1),
(52, 2),
(52, 4),
(53, 1),
(53, 2),
(53, 4),
(54, 1),
(54, 2),
(54, 4),
(55, 1),
(55, 2),
(55, 4),
(56, 1),
(56, 2),
(56, 4),
(57, 1),
(57, 2),
(57, 4),
(58, 1),
(58, 2),
(58, 4),
(59, 1),
(59, 2),
(59, 4),
(60, 1),
(60, 2),
(60, 4),
(61, 1),
(61, 2),
(61, 4),
(62, 1),
(62, 2),
(62, 4),
(63, 1),
(63, 2),
(63, 4),
(64, 1),
(64, 2),
(64, 4),
(65, 1),
(65, 2),
(65, 4),
(66, 1),
(66, 2),
(66, 4),
(67, 1),
(67, 2),
(67, 4),
(68, 1),
(68, 2),
(68, 4),
(69, 1),
(69, 2),
(69, 4),
(70, 1),
(70, 2),
(70, 4),
(71, 1),
(71, 2),
(71, 4),
(72, 1),
(72, 2),
(72, 4),
(73, 1),
(73, 2),
(73, 4),
(74, 1),
(74, 2),
(74, 4),
(75, 1),
(75, 2),
(75, 4),
(76, 1),
(76, 2),
(76, 4),
(77, 1),
(77, 2),
(77, 3),
(77, 4),
(77, 5),
(77, 6),
(77, 7),
(77, 8),
(77, 9),
(78, 1),
(78, 2),
(78, 3),
(78, 4),
(78, 5),
(78, 6),
(78, 7),
(78, 8),
(78, 9),
(79, 1),
(79, 2),
(79, 3),
(79, 4),
(79, 5),
(79, 6),
(79, 7),
(79, 8),
(79, 9),
(80, 1),
(80, 2),
(80, 3),
(80, 4),
(80, 5),
(80, 6),
(80, 7),
(80, 8),
(80, 9),
(81, 1),
(81, 2),
(81, 4),
(82, 1),
(82, 2),
(82, 4),
(83, 1),
(83, 2),
(83, 4),
(84, 1),
(84, 2),
(84, 4),
(85, 1),
(86, 1),
(87, 1),
(88, 1),
(89, 1),
(89, 2),
(90, 1),
(90, 2),
(91, 1),
(91, 2),
(92, 1),
(92, 2),
(93, 1),
(93, 2),
(93, 4),
(93, 5),
(94, 1),
(94, 2),
(94, 4),
(94, 5),
(95, 1),
(95, 2),
(95, 4),
(95, 5),
(96, 1),
(96, 2),
(96, 4),
(96, 5),
(97, 1),
(97, 2),
(97, 3),
(97, 5),
(97, 6),
(97, 8),
(98, 1),
(98, 2),
(98, 3),
(98, 5),
(98, 6),
(98, 8),
(99, 1),
(99, 2),
(99, 3),
(99, 5),
(99, 6),
(99, 8),
(100, 1),
(100, 2),
(100, 3),
(100, 5),
(100, 6),
(100, 8),
(101, 1),
(101, 2),
(101, 3),
(101, 6),
(102, 1),
(102, 2),
(102, 3),
(102, 6),
(103, 1),
(103, 2),
(103, 3),
(103, 6),
(104, 1),
(104, 2),
(104, 5),
(104, 8),
(105, 1),
(105, 2),
(105, 5),
(105, 8),
(106, 1),
(106, 2),
(106, 5),
(106, 8),
(107, 1),
(107, 2),
(107, 5),
(107, 8),
(108, 1),
(108, 2),
(108, 5),
(108, 8),
(109, 1),
(109, 2),
(109, 5),
(109, 8),
(110, 1),
(110, 2),
(110, 5),
(110, 8),
(111, 1),
(111, 2),
(111, 5),
(111, 8),
(112, 1),
(112, 2),
(112, 5),
(113, 1),
(113, 2),
(113, 5),
(114, 1),
(114, 2),
(114, 5),
(115, 1),
(115, 2),
(115, 5),
(116, 1),
(116, 2),
(116, 5),
(117, 1),
(117, 2),
(117, 5),
(118, 1),
(118, 2),
(118, 5),
(119, 1),
(119, 2),
(119, 5),
(120, 1),
(120, 2),
(120, 3),
(120, 6),
(121, 1),
(121, 2),
(121, 3),
(121, 6),
(122, 1),
(122, 2),
(122, 3),
(122, 6),
(123, 1),
(123, 2),
(123, 3),
(123, 6),
(124, 1),
(124, 2),
(124, 3),
(124, 6),
(125, 1),
(125, 2),
(125, 3),
(125, 6),
(126, 1),
(126, 2),
(126, 3),
(126, 6),
(127, 1),
(127, 2),
(127, 3),
(127, 6),
(128, 1),
(128, 2),
(128, 3),
(129, 1),
(129, 2),
(129, 3),
(130, 1),
(130, 2),
(130, 3),
(131, 1),
(131, 2),
(131, 3),
(132, 1),
(132, 2),
(132, 3),
(133, 1),
(133, 2),
(133, 3),
(134, 1),
(134, 2),
(134, 3),
(135, 1),
(135, 2),
(135, 3),
(136, 1),
(136, 2),
(136, 3),
(137, 1),
(137, 2),
(137, 3),
(138, 1),
(138, 2),
(138, 3),
(139, 1),
(139, 2),
(139, 3),
(140, 1),
(140, 2),
(140, 3),
(140, 7),
(141, 1),
(141, 2),
(141, 3),
(141, 7),
(142, 1),
(142, 2),
(142, 3),
(142, 7),
(143, 1),
(143, 2),
(143, 3),
(143, 7),
(144, 1),
(144, 2),
(144, 3),
(144, 7),
(144, 8),
(145, 1),
(145, 2),
(145, 3),
(145, 7),
(145, 8),
(146, 1),
(146, 2),
(146, 3),
(146, 7),
(146, 8),
(147, 1),
(147, 2),
(147, 3),
(147, 7),
(147, 8),
(148, 1),
(148, 2),
(148, 3),
(149, 1),
(149, 2),
(149, 3),
(150, 1),
(150, 2),
(150, 3),
(151, 1),
(151, 2),
(151, 3),
(152, 1),
(152, 2),
(152, 7),
(153, 1),
(153, 2),
(153, 7),
(154, 1),
(154, 2),
(154, 7),
(155, 1),
(155, 2),
(155, 7),
(156, 1),
(156, 2),
(156, 7),
(156, 8),
(157, 1),
(157, 2),
(157, 7),
(157, 8),
(158, 1),
(158, 2),
(158, 7),
(158, 8),
(159, 1),
(159, 2),
(159, 7),
(159, 8),
(160, 1),
(160, 2),
(160, 7),
(161, 1),
(161, 2),
(161, 7),
(162, 1),
(162, 2),
(162, 7),
(163, 1),
(163, 2),
(163, 7),
(164, 1),
(164, 2),
(164, 3),
(164, 4),
(164, 9),
(165, 1),
(165, 2),
(165, 3),
(165, 4),
(165, 9),
(166, 1),
(166, 2),
(166, 3),
(166, 4),
(166, 9),
(167, 1),
(167, 2),
(167, 3),
(167, 4),
(167, 9),
(168, 1),
(169, 1),
(170, 1),
(171, 1);

-- --------------------------------------------------------

--
-- Table structure for table `salary_advances`
--

CREATE TABLE `salary_advances` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_id` bigint(20) UNSIGNED NOT NULL,
  `payment_method_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_account_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `advance_number` varchar(255) NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `deducted_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `payment_date` date NOT NULL,
  `deduction_start_date` date NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending_review',
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `salary_advances`
--

INSERT INTO `salary_advances` (`id`, `employee_id`, `payment_method_id`, `accounting_account_id`, `accounting_transaction_id`, `created_by`, `reviewed_by`, `approved_by`, `rejected_by`, `advance_number`, `amount`, `deducted_amount`, `payment_date`, `deduction_start_date`, `status`, `reviewed_at`, `approved_at`, `rejected_at`, `rejection_reason`, `reason`, `notes`, `created_at`, `updated_at`) VALUES
(1, 5, 2, 9, 13, 4, 2, 1, NULL, 'ADV-DEMO-00001', 3000.00, 3000.00, '2026-07-01', '2026-07-15', 'deducted', '2026-07-01 04:45:00', '2026-07-01 05:00:00', NULL, NULL, 'Emergency salary advance before employee resignation.', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 1, 2, 9, NULL, 4, NULL, NULL, NULL, 'ADV-DEMO-00002', 1500.00, 0.00, '2026-07-20', '2026-08-01', 'pending_review', NULL, NULL, NULL, NULL, 'School expense request.', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 2, 2, 9, NULL, 4, NULL, NULL, 1, 'ADV-DEMO-00003', 2000.00, 0.00, '2026-07-21', '2026-08-01', 'rejected', NULL, NULL, '2026-07-22 05:30:00', 'Insufficient supporting information.', 'Travel advance request.', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `service_areas`
--

CREATE TABLE `service_areas` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `mosque_name` varchar(255) DEFAULT NULL,
  `district` varchar(255) DEFAULT NULL,
  `street_block_village` varchar(255) DEFAULT NULL,
  `representative_name` varchar(255) DEFAULT NULL,
  `representative_phone` varchar(255) DEFAULT NULL,
  `households_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `rate_per_cubic_meter` decimal(12,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `inactive_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `service_areas`
--

INSERT INTO `service_areas` (`id`, `name`, `mosque_name`, `district`, `street_block_village`, `representative_name`, `representative_phone`, `households_count`, `rate_per_cubic_meter`, `status`, `inactive_reason`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'Karte Parwan Zone', 'Omar Mosque', 'District 4', 'Block A', 'Ahmad Zia', '0788000000', 120, 65.00, 'active', NULL, NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(2, 'Khair Khana Zone', 'Bilal Mosque', 'District 11', 'Street 7', 'Karim Shah', '0788111222', 95, 70.00, 'active', NULL, NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(3, 'Dasht-e-Barchi Zone', 'Rahman Mosque', 'District 13', 'Block C', 'Samiullah Wardak', '0788222333', 110, 60.00, 'active', NULL, NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(4, 'TEST Billing Zone', 'TEST Central Mosque', 'District 4', 'TEST Block A', 'TEST Representative', '0797000000', 20, 65.00, 'active', NULL, 'Dedicated area for repeatable invoice-first workflow demonstrations.', '2026-07-28 05:26:23', '2026-07-28 05:26:23');

-- --------------------------------------------------------

--
-- Table structure for table `sessions`
--

CREATE TABLE `sessions` (
  `id` varchar(255) NOT NULL,
  `user_id` bigint(20) UNSIGNED DEFAULT NULL,
  `ip_address` varchar(45) DEFAULT NULL,
  `user_agent` text DEFAULT NULL,
  `payload` longtext NOT NULL,
  `last_activity` int(11) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `shareholders`
--

CREATE TABLE `shareholders` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `shareholder_number` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `father_name` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `email` varchar(255) DEFAULT NULL,
  `investment_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `ownership_percentage` decimal(7,4) NOT NULL,
  `joined_on` date DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shareholders`
--

INSERT INTO `shareholders` (`id`, `shareholder_number`, `name`, `father_name`, `phone`, `email`, `investment_amount`, `ownership_percentage`, `joined_on`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'SHR-00001', 'Abdul Rahman Safi', NULL, '0798111001', NULL, 500000.00, 50.0000, NULL, 'active', 'Full-system demo shareholder.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(2, 'SHR-00002', 'Farida Noori', NULL, '0798111002', NULL, 300000.00, 30.0000, NULL, 'active', 'Full-system demo shareholder.', '2026-07-28 05:26:28', '2026-07-28 05:26:28'),
(3, 'SHR-00003', 'Hamid Wardak', NULL, '0798111003', NULL, 200000.00, 20.0000, NULL, 'active', 'Full-system demo shareholder.', '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `shareholder_distributions`
--

CREATE TABLE `shareholder_distributions` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `financial_period_closing_id` bigint(20) UNSIGNED NOT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `reviewed_by` bigint(20) UNSIGNED DEFAULT NULL,
  `approved_by` bigint(20) UNSIGNED DEFAULT NULL,
  `rejected_by` bigint(20) UNSIGNED DEFAULT NULL,
  `distribution_number` varchar(255) NOT NULL,
  `distributable_amount` decimal(16,2) NOT NULL,
  `allocated_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'draft',
  `submitted_at` timestamp NULL DEFAULT NULL,
  `reviewed_at` timestamp NULL DEFAULT NULL,
  `approved_at` timestamp NULL DEFAULT NULL,
  `rejected_at` timestamp NULL DEFAULT NULL,
  `rejection_reason` text DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shareholder_distributions`
--

INSERT INTO `shareholder_distributions` (`id`, `financial_period_closing_id`, `created_by`, `reviewed_by`, `approved_by`, `rejected_by`, `distribution_number`, `distributable_amount`, `allocated_amount`, `paid_amount`, `status`, `submitted_at`, `reviewed_at`, `approved_at`, `rejected_at`, `rejection_reason`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 3, 2, 1, NULL, 'DST-20260728-00001', 279750.00, 279750.00, 279750.00, 'paid', '2026-07-28 05:26:28', '2026-07-28 05:26:28', '2026-07-28 05:26:28', NULL, NULL, 'Ownership-based demo profit distribution.', '2026-07-28 05:26:28', '2026-07-28 05:26:30'),
(2, 2, 3, 2, 1, NULL, 'DST-20260728-00002', 300300.00, 300300.00, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:29', NULL, NULL, 'Ownership-based demo profit distribution.', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(3, 3, 3, 2, 1, NULL, 'DST-20260728-00003', 325853.31, 325853.31, 0.00, 'approved', '2026-07-28 05:26:29', '2026-07-28 05:26:29', '2026-07-28 05:26:30', NULL, NULL, 'Ownership-based demo profit distribution.', '2026-07-28 05:26:29', '2026-07-28 05:26:30');

-- --------------------------------------------------------

--
-- Table structure for table `shareholder_distribution_items`
--

CREATE TABLE `shareholder_distribution_items` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `shareholder_distribution_id` bigint(20) UNSIGNED NOT NULL,
  `shareholder_id` bigint(20) UNSIGNED NOT NULL,
  `percentage_snapshot` decimal(7,4) NOT NULL,
  `entitlement_amount` decimal(16,2) NOT NULL,
  `paid_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shareholder_distribution_items`
--

INSERT INTO `shareholder_distribution_items` (`id`, `shareholder_distribution_id`, `shareholder_id`, `percentage_snapshot`, `entitlement_amount`, `paid_amount`, `status`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 50.0000, 139875.00, 139875.00, 'paid', '2026-07-28 05:26:28', '2026-07-28 05:26:30'),
(2, 1, 2, 30.0000, 83925.00, 83925.00, 'paid', '2026-07-28 05:26:28', '2026-07-28 05:26:30'),
(3, 1, 3, 20.0000, 55950.00, 55950.00, 'paid', '2026-07-28 05:26:28', '2026-07-28 05:26:30'),
(4, 2, 1, 50.0000, 150150.00, 0.00, 'pending', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(5, 2, 2, 30.0000, 90090.00, 0.00, 'pending', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(6, 2, 3, 20.0000, 60060.00, 0.00, 'pending', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(7, 3, 1, 50.0000, 162926.66, 0.00, 'pending', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(8, 3, 2, 30.0000, 97755.99, 0.00, 'pending', '2026-07-28 05:26:29', '2026-07-28 05:26:29'),
(9, 3, 3, 20.0000, 65170.66, 0.00, 'pending', '2026-07-28 05:26:29', '2026-07-28 05:26:29');

-- --------------------------------------------------------

--
-- Table structure for table `shareholder_payments`
--

CREATE TABLE `shareholder_payments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `shareholder_distribution_item_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_account_id` bigint(20) UNSIGNED NOT NULL,
  `payment_method_id` bigint(20) UNSIGNED NOT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `payment_number` varchar(255) NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `payment_date` date NOT NULL,
  `receipt_number` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending_review',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `shareholder_payments`
--

INSERT INTO `shareholder_payments` (`id`, `shareholder_distribution_item_id`, `accounting_account_id`, `payment_method_id`, `accounting_transaction_id`, `created_by`, `payment_number`, `amount`, `payment_date`, `receipt_number`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 1, 2, 2, 34, 3, 'SHP-20260728-00001', 139875.00, '2026-07-25', 'DEMO-SH-PAY-1', 'paid', 'Paid first demo distribution entitlement in full.', '2026-07-28 05:26:30', '2026-07-28 05:26:30'),
(2, 2, 2, 2, 35, 3, 'SHP-20260728-00002', 83925.00, '2026-07-26', 'DEMO-SH-PAY-2', 'paid', 'Paid first demo distribution entitlement in full.', '2026-07-28 05:26:30', '2026-07-28 05:26:30'),
(3, 3, 2, 2, 36, 3, 'SHP-20260728-00003', 55950.00, '2026-07-27', 'DEMO-SH-PAY-3', 'paid', 'Paid first demo distribution entitlement in full.', '2026-07-28 05:26:30', '2026-07-28 05:26:30');

-- --------------------------------------------------------

--
-- Table structure for table `suppliers`
--

CREATE TABLE `suppliers` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `supplier_type` varchar(255) DEFAULT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `address` varchar(255) DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `suppliers`
--

INSERT INTO `suppliers` (`id`, `name`, `supplier_type`, `phone`, `address`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'Kabul Pipe Supplies', 'pipe', NULL, NULL, 'active', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 'Afghan Meter Company', 'meter', NULL, NULL, 'active', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 'Kabul Valve & Fittings', 'technical', '0798333444', NULL, 'active', NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `supplier_installments`
--

CREATE TABLE `supplier_installments` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `supplier_purchase_contract_id` bigint(20) UNSIGNED NOT NULL,
  `payment_method_id` bigint(20) UNSIGNED DEFAULT NULL,
  `accounting_account_id` bigint(20) UNSIGNED DEFAULT NULL,
  `recorded_by` bigint(20) UNSIGNED DEFAULT NULL,
  `accounting_transaction_id` bigint(20) UNSIGNED DEFAULT NULL,
  `installment_number` int(10) UNSIGNED NOT NULL,
  `due_date` date NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `paid_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `paid_at` date DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'pending',
  `receipt_number` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `supplier_purchase_contracts`
--

CREATE TABLE `supplier_purchase_contracts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `supplier_id` bigint(20) UNSIGNED NOT NULL,
  `financial_category_id` bigint(20) UNSIGNED DEFAULT NULL,
  `created_by` bigint(20) UNSIGNED DEFAULT NULL,
  `contract_number` varchar(255) NOT NULL,
  `item_type` varchar(255) NOT NULL,
  `total_amount` decimal(16,2) NOT NULL,
  `down_payment_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `paid_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `remaining_amount` decimal(16,2) NOT NULL DEFAULT 0.00,
  `installments_count` int(10) UNSIGNED NOT NULL DEFAULT 0,
  `installment_start_date` date DEFAULT NULL,
  `installment_end_date` date DEFAULT NULL,
  `next_payment_date` date DEFAULT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `attachment_path` varchar(255) DEFAULT NULL,
  `attachment_original_name` varchar(255) DEFAULT NULL,
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- --------------------------------------------------------

--
-- Table structure for table `system_settings`
--

CREATE TABLE `system_settings` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `key` varchar(255) NOT NULL,
  `value` longtext CHARACTER SET utf8mb4 COLLATE utf8mb4_bin DEFAULT NULL CHECK (json_valid(`value`)),
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `system_settings`
--

INSERT INTO `system_settings` (`id`, `key`, `value`, `created_at`, `updated_at`) VALUES
(1, 'system_profile', '{\"company_name\":\"WaterNet MIS\",\"system_name\":\"Water Supply Management Information System\",\"currency\":\"AFN\",\"language\":\"en\",\"phone\":\"0799000000\",\"address\":\"Kabul, Afghanistan\"}', '2026-07-28 05:26:21', '2026-07-28 05:26:21');

-- --------------------------------------------------------

--
-- Table structure for table `termination_advance_allocations`
--

CREATE TABLE `termination_advance_allocations` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `employee_termination_id` bigint(20) UNSIGNED NOT NULL,
  `salary_advance_id` bigint(20) UNSIGNED NOT NULL,
  `amount` decimal(16,2) NOT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `termination_advance_allocations`
--

INSERT INTO `termination_advance_allocations` (`id`, `employee_termination_id`, `salary_advance_id`, `amount`, `created_at`, `updated_at`) VALUES
(1, 1, 1, 3000.00, '2026-07-28 05:26:27', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `users`
--

CREATE TABLE `users` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(255) DEFAULT NULL,
  `email_verified_at` timestamp NULL DEFAULT NULL,
  `password` varchar(255) NOT NULL,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `last_login_at` timestamp NULL DEFAULT NULL,
  `remember_token` varchar(100) DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `users`
--

INSERT INTO `users` (`id`, `name`, `email`, `phone`, `email_verified_at`, `password`, `status`, `last_login_at`, `remember_token`, `created_at`, `updated_at`) VALUES
(1, 'WaterNet Demo Admin', 'admin@waternet.local', '0799000000', NULL, '$2y$12$Qepckg9ddFV.LpVe3.CT2O0S47YrJMyMabKGDeD8ds3BK4n.co95u', 'active', '2026-07-29 00:28:14', NULL, '2026-07-28 05:26:19', '2026-07-29 00:28:14'),
(2, 'Nadia Safi', 'manager@waternet.local', '0799001001', NULL, '$2y$12$ZAK.TGeVOCzp.PkAPEo02uq8KfG6agTIFZDndPnP.ORMVoFlNjI3G', 'active', NULL, NULL, '2026-07-28 05:26:19', '2026-07-28 05:26:24'),
(3, 'Laila Rahimi', 'accountant@waternet.local', '0799001003', NULL, '$2y$12$uPCYHltjyaJMSSo/srlkVOIPV9VwRTuKaFuz/imWvALGbDxJBk4o2', 'active', NULL, NULL, '2026-07-28 05:26:20', '2026-07-28 05:26:25'),
(4, 'Maryam Habibi', 'hr@waternet.local', '0799001002', NULL, '$2y$12$7TrGIkyPczjjmx9UaTUDTO9BvcOjSD1AaYT/.CXnurgzckIEVLyum', 'active', NULL, NULL, '2026-07-28 05:26:20', '2026-07-28 05:26:24'),
(5, 'Ahmad Karimi', 'technician@waternet.local', '0799111222', NULL, '$2y$12$ybd9U/n0VDYXu4AQbpA21e7gp9jcW0HbTuYBBbKr212PoTSebn1za', 'active', NULL, NULL, '2026-07-28 05:26:20', '2026-07-28 05:26:25'),
(6, 'WaterNet Demo Reader', 'reader@waternet.local', '0799000004', NULL, '$2y$12$kcjNRsAL5sLVPpTilAfAauTgGrQLIpkWx4QaFBEEehR4spnKa6R1G', 'active', NULL, NULL, '2026-07-28 05:26:20', '2026-07-28 05:26:23'),
(7, 'WaterNet Demo Collector', 'collector@waternet.local', '0799000002', NULL, '$2y$12$1wTx0L/7yXi9PkzuI2UjfekAb5fuUPjSge0NnuF.Q2G06abgiwywC', 'active', NULL, NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:22'),
(8, 'Habib Wardak', 'warehouse@waternet.local', '0799000007', NULL, '$2y$12$zv4lXSyn32vqraZGGK7REeybtAXvVHvRyKgXhxOaxrUY8kI6wAtGe', 'active', NULL, NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(9, 'Report Viewer', 'viewer@waternet.local', '0799000008', NULL, '$2y$12$fy2gV.1EAXyVhIcEt4uHkO/DuoU0M29jnWy6OnPaGmWQccgzoJHou', 'active', NULL, NULL, '2026-07-28 05:26:21', '2026-07-28 05:26:21'),
(10, 'Farid Safi', 'farid.safi@waternet.local', '0799001004', NULL, '$2y$12$6SZgCtHoZbA7eXOPKJVo4.WMsPHI2b9tWrEtGS7xaZ1UngQxQgAFC', 'inactive', NULL, NULL, '2026-07-28 05:26:25', '2026-07-28 05:26:27');

-- --------------------------------------------------------

--
-- Table structure for table `warehouses`
--

CREATE TABLE `warehouses` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `name` varchar(255) NOT NULL,
  `code` varchar(255) NOT NULL,
  `address` text DEFAULT NULL,
  `service_area_id` bigint(20) UNSIGNED DEFAULT NULL,
  `status` enum('active','inactive') NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `warehouses`
--

INSERT INTO `warehouses` (`id`, `name`, `code`, `address`, `service_area_id`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'Main Warehouse', 'WH-MAIN', NULL, 1, 'active', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(2, 'Field Warehouse', 'WH-FIELD', NULL, 1, 'active', NULL, '2026-07-28 05:26:27', '2026-07-28 05:26:27'),
(3, 'North Service Warehouse', 'WH-NORTH', 'North Kabul', 3, 'active', NULL, '2026-07-28 05:26:28', '2026-07-28 05:26:28');

-- --------------------------------------------------------

--
-- Table structure for table `work_shifts`
--

CREATE TABLE `work_shifts` (
  `id` bigint(20) UNSIGNED NOT NULL,
  `code` varchar(255) NOT NULL,
  `name` varchar(255) NOT NULL,
  `start_time` time NOT NULL,
  `end_time` time NOT NULL,
  `break_minutes` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `late_grace_minutes` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `overtime_after_minutes` smallint(5) UNSIGNED NOT NULL DEFAULT 0,
  `status` varchar(255) NOT NULL DEFAULT 'active',
  `notes` text DEFAULT NULL,
  `created_at` timestamp NULL DEFAULT NULL,
  `updated_at` timestamp NULL DEFAULT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

--
-- Dumping data for table `work_shifts`
--

INSERT INTO `work_shifts` (`id`, `code`, `name`, `start_time`, `end_time`, `break_minutes`, `late_grace_minutes`, `overtime_after_minutes`, `status`, `notes`, `created_at`, `updated_at`) VALUES
(1, 'standard', 'Standard Shift', '08:00:00', '16:00:00', 0, 10, 0, 'active', NULL, '2026-07-28 05:26:14', '2026-07-28 05:26:14'),
(2, 'field', 'Field Shift', '07:30:00', '15:30:00', 30, 10, 15, 'active', 'Demo field roster for technicians.', '2026-07-28 05:26:25', '2026-07-28 05:26:25'),
(3, 'office', 'Office Shift', '08:30:00', '16:30:00', 30, 10, 15, 'active', 'Demo office roster for HR and finance.', '2026-07-28 05:26:25', '2026-07-28 05:26:25');

--
-- Indexes for dumped tables
--

--
-- Indexes for table `accounting_accounts`
--
ALTER TABLE `accounting_accounts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `accounting_accounts_code_unique` (`code`);

--
-- Indexes for table `accounting_transactions`
--
ALTER TABLE `accounting_transactions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `accounting_transactions_transaction_number_unique` (`transaction_number`),
  ADD KEY `accounting_transactions_financial_category_id_foreign` (`financial_category_id`),
  ADD KEY `accounting_transactions_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `accounting_transactions_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `accounting_transactions_customer_id_foreign` (`customer_id`),
  ADD KEY `accounting_transactions_supplier_id_foreign` (`supplier_id`),
  ADD KEY `accounting_transactions_supplier_installment_id_foreign` (`supplier_installment_id`),
  ADD KEY `accounting_transactions_recorded_by_foreign` (`recorded_by`),
  ADD KEY `accounting_transactions_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `accounting_transactions_approved_by_foreign` (`approved_by`),
  ADD KEY `accounting_transactions_rejected_by_foreign` (`rejected_by`),
  ADD KEY `accounting_transactions_type_status_index` (`type`,`status`),
  ADD KEY `accounting_transactions_transaction_date_status_index` (`transaction_date`,`status`),
  ADD KEY `accounting_transactions_source_type_source_id_index` (`source_type`,`source_id`);

--
-- Indexes for table `account_reconciliations`
--
ALTER TABLE `account_reconciliations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `account_reconciliation_period_unique` (`accounting_account_id`,`period_end`),
  ADD UNIQUE KEY `account_reconciliations_reconciliation_number_unique` (`reconciliation_number`),
  ADD KEY `account_reconciliations_created_by_foreign` (`created_by`),
  ADD KEY `account_reconciliations_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `account_reconciliations_approved_by_foreign` (`approved_by`),
  ADD KEY `account_reconciliations_rejected_by_foreign` (`rejected_by`),
  ADD KEY `account_reconciliations_status_period_end_index` (`status`,`period_end`);

--
-- Indexes for table `account_reconciliation_items`
--
ALTER TABLE `account_reconciliation_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `reconciliation_items_parent_fk` (`account_reconciliation_id`);

--
-- Indexes for table `assets`
--
ALTER TABLE `assets`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `assets_asset_code_unique` (`asset_code`),
  ADD KEY `assets_supplier_id_foreign` (`supplier_id`),
  ADD KEY `assets_created_by_foreign` (`created_by`),
  ADD KEY `assets_type_status_index` (`type`,`status`),
  ADD KEY `assets_asset_code_index` (`asset_code`),
  ADD KEY `assets_service_area_id_index` (`service_area_id`),
  ADD KEY `assets_asset_purchase_id_foreign` (`asset_purchase_id`);

--
-- Indexes for table `asset_maintenance`
--
ALTER TABLE `asset_maintenance`
  ADD PRIMARY KEY (`id`),
  ADD KEY `asset_maintenance_created_by_foreign` (`created_by`),
  ADD KEY `asset_maintenance_asset_id_status_index` (`asset_id`,`status`),
  ADD KEY `asset_maintenance_next_due_date_index` (`next_due_date`),
  ADD KEY `asset_maintenance_maintenance_type_index` (`maintenance_type`);

--
-- Indexes for table `asset_purchases`
--
ALTER TABLE `asset_purchases`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `asset_purchases_purchase_number_unique` (`purchase_number`),
  ADD UNIQUE KEY `asset_purchases_accounting_transaction_id_unique` (`accounting_transaction_id`),
  ADD KEY `asset_purchases_service_area_id_foreign` (`service_area_id`),
  ADD KEY `asset_purchases_financial_category_id_foreign` (`financial_category_id`),
  ADD KEY `asset_purchases_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `asset_purchases_created_by_foreign` (`created_by`),
  ADD KEY `asset_purchases_status_purchase_date_index` (`status`,`purchase_date`),
  ADD KEY `asset_purchases_supplier_id_purchase_date_index` (`supplier_id`,`purchase_date`),
  ADD KEY `asset_purchases_accounting_account_id_purchase_date_index` (`accounting_account_id`,`purchase_date`);

--
-- Indexes for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `attendance_records_employee_id_attendance_date_unique` (`employee_id`,`attendance_date`),
  ADD KEY `attendance_records_leave_request_id_foreign` (`leave_request_id`),
  ADD KEY `attendance_records_recorded_by_foreign` (`recorded_by`),
  ADD KEY `attendance_records_approved_by_foreign` (`approved_by`),
  ADD KEY `attendance_records_attendance_date_approval_status_index` (`attendance_date`,`approval_status`),
  ADD KEY `attendance_records_biometric_import_batch_id_foreign` (`biometric_import_batch_id`);

--
-- Indexes for table `billing_periods`
--
ALTER TABLE `billing_periods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `billing_periods_code_unique` (`code`);

--
-- Indexes for table `biometric_import_batches`
--
ALTER TABLE `biometric_import_batches`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `biometric_import_batches_batch_number_unique` (`batch_number`),
  ADD KEY `biometric_import_batches_imported_by_foreign` (`imported_by`);

--
-- Indexes for table `cache`
--
ALTER TABLE `cache`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_expiration_index` (`expiration`);

--
-- Indexes for table `cache_locks`
--
ALTER TABLE `cache_locks`
  ADD PRIMARY KEY (`key`),
  ADD KEY `cache_locks_expiration_index` (`expiration`);

--
-- Indexes for table `customers`
--
ALTER TABLE `customers`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customers_subscription_code_unique` (`subscription_code`),
  ADD UNIQUE KEY `customers_phone_unique` (`phone`),
  ADD UNIQUE KEY `customers_tazkira_number_unique` (`tazkira_number`),
  ADD KEY `customers_service_area_id_foreign` (`service_area_id`),
  ADD KEY `customers_approved_by_foreign` (`approved_by`),
  ADD KEY `customers_rejected_by_foreign` (`rejected_by`),
  ADD KEY `customers_agreement_payment_method_id_foreign` (`agreement_payment_method_id`),
  ADD KEY `customers_agreement_accounting_account_id_foreign` (`agreement_accounting_account_id`),
  ADD KEY `customers_agreement_payment_received_by_foreign` (`agreement_payment_received_by`),
  ADD KEY `customers_agreement_payment_id_foreign` (`agreement_payment_id`);

--
-- Indexes for table `customer_charges`
--
ALTER TABLE `customer_charges`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_charges_financial_category_id_foreign` (`financial_category_id`),
  ADD KEY `customer_charges_accounting_transaction_id_foreign` (`accounting_transaction_id`),
  ADD KEY `customer_charges_created_by_foreign` (`created_by`),
  ADD KEY `customer_charges_customer_id_status_index` (`customer_id`,`status`),
  ADD KEY `customer_charges_charge_date_status_index` (`charge_date`,`status`),
  ADD KEY `customer_charges_customer_contract_id_foreign` (`customer_contract_id`),
  ADD KEY `customer_charges_customer_charge_type_id_foreign` (`customer_charge_type_id`),
  ADD KEY `customer_charges_invoice_id_foreign` (`invoice_id`);

--
-- Indexes for table `customer_charge_types`
--
ALTER TABLE `customer_charge_types`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customer_charge_types_code_unique` (`code`),
  ADD KEY `customer_charge_types_status_name_index` (`status`,`name`);

--
-- Indexes for table `customer_connection_events`
--
ALTER TABLE `customer_connection_events`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_connection_events_processed_by_foreign` (`processed_by`),
  ADD KEY `customer_connection_events_customer_charge_id_foreign` (`customer_charge_id`),
  ADD KEY `customer_connection_events_customer_id_event_type_index` (`customer_id`,`event_type`),
  ADD KEY `customer_connection_events_status_created_at_index` (`status`,`created_at`);

--
-- Indexes for table `customer_contracts`
--
ALTER TABLE `customer_contracts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customer_contracts_contract_number_unique` (`contract_number`),
  ADD KEY `customer_contracts_created_by_foreign` (`created_by`),
  ADD KEY `customer_contracts_updated_by_foreign` (`updated_by`),
  ADD KEY `customer_contracts_approved_by_foreign` (`approved_by`),
  ADD KEY `customer_contracts_rejected_by_foreign` (`rejected_by`),
  ADD KEY `customer_contracts_customer_id_status_index` (`customer_id`,`status`),
  ADD KEY `customer_contracts_status_submitted_at_index` (`status`,`submitted_at`),
  ADD KEY `customer_contracts_submitted_by_foreign` (`submitted_by`),
  ADD KEY `customer_contracts_confirmed_by_foreign` (`confirmed_by`);

--
-- Indexes for table `customer_deposits`
--
ALTER TABLE `customer_deposits`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customer_deposits_receipt_number_unique` (`receipt_number`),
  ADD UNIQUE KEY `customer_deposits_refund_receipt_number_unique` (`refund_receipt_number`),
  ADD KEY `customer_deposits_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `customer_deposits_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `customer_deposits_received_by_foreign` (`received_by`),
  ADD KEY `customer_deposits_applied_by_foreign` (`applied_by`),
  ADD KEY `customer_deposits_refunded_by_foreign` (`refunded_by`),
  ADD KEY `customer_deposits_accounting_transaction_id_foreign` (`accounting_transaction_id`),
  ADD KEY `customer_deposits_refund_transaction_id_foreign` (`refund_transaction_id`),
  ADD KEY `customer_deposits_payment_id_foreign` (`payment_id`),
  ADD KEY `customer_deposits_customer_id_status_index` (`customer_id`,`status`),
  ADD KEY `customer_deposits_customer_contract_id_status_index` (`customer_contract_id`,`status`);

--
-- Indexes for table `customer_deposit_allocations`
--
ALTER TABLE `customer_deposit_allocations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `deposit_charge_unique` (`customer_deposit_id`,`customer_charge_id`),
  ADD KEY `customer_deposit_allocations_customer_charge_id_foreign` (`customer_charge_id`);

--
-- Indexes for table `customer_documents`
--
ALTER TABLE `customer_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `customer_documents_uploaded_by_foreign` (`uploaded_by`),
  ADD KEY `customer_documents_customer_id_created_at_index` (`customer_id`,`created_at`);

--
-- Indexes for table `customer_service_requests`
--
ALTER TABLE `customer_service_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `customer_service_requests_request_number_unique` (`request_number`),
  ADD KEY `customer_service_requests_assigned_to_foreign` (`assigned_to`),
  ADD KEY `customer_service_requests_created_by_foreign` (`created_by`),
  ADD KEY `customer_service_requests_customer_id_status_index` (`customer_id`,`status`),
  ADD KEY `customer_service_requests_requested_at_priority_index` (`requested_at`,`priority`),
  ADD KEY `customer_service_requests_closed_by_foreign` (`closed_by`);

--
-- Indexes for table `departments`
--
ALTER TABLE `departments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `departments_code_unique` (`code`);

--
-- Indexes for table `employees`
--
ALTER TABLE `employees`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employees_employee_number_unique` (`employee_number`),
  ADD UNIQUE KEY `employees_user_id_unique` (`user_id`),
  ADD UNIQUE KEY `employees_tazkira_number_unique` (`tazkira_number`),
  ADD UNIQUE KEY `employees_email_unique` (`email`),
  ADD UNIQUE KEY `employees_biometric_id_unique` (`biometric_id`),
  ADD KEY `employees_job_position_id_foreign` (`job_position_id`),
  ADD KEY `employees_service_area_id_foreign` (`service_area_id`),
  ADD KEY `employees_referred_by_shareholder_id_foreign` (`referred_by_shareholder_id`),
  ADD KEY `employees_created_by_foreign` (`created_by`),
  ADD KEY `employees_updated_by_foreign` (`updated_by`),
  ADD KEY `employees_status_hire_date_index` (`status`,`hire_date`);

--
-- Indexes for table `employee_adjustments`
--
ALTER TABLE `employee_adjustments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employee_adjustments_adjustment_number_unique` (`adjustment_number`),
  ADD KEY `employee_adjustments_payroll_item_id_foreign` (`payroll_item_id`),
  ADD KEY `employee_adjustments_created_by_foreign` (`created_by`),
  ADD KEY `employee_adjustments_approved_by_foreign` (`approved_by`),
  ADD KEY `employee_adjustments_employee_id_effective_date_status_index` (`employee_id`,`effective_date`,`status`);

--
-- Indexes for table `employee_documents`
--
ALTER TABLE `employee_documents`
  ADD PRIMARY KEY (`id`),
  ADD KEY `employee_documents_employee_id_foreign` (`employee_id`),
  ADD KEY `employee_documents_uploaded_by_foreign` (`uploaded_by`);

--
-- Indexes for table `employee_leave_balances`
--
ALTER TABLE `employee_leave_balances`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employee_policy_year_unique` (`employee_id`,`leave_policy_id`,`year`),
  ADD KEY `employee_leave_balances_leave_policy_id_foreign` (`leave_policy_id`);

--
-- Indexes for table `employee_payroll_deductions`
--
ALTER TABLE `employee_payroll_deductions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `employee_deduction_rule_fk` (`payroll_deduction_rule_id`),
  ADD KEY `employee_payroll_deductions_assigned_by_foreign` (`assigned_by`),
  ADD KEY `employee_deduction_period_index` (`employee_id`,`effective_from`,`effective_to`);

--
-- Indexes for table `employee_shift_assignments`
--
ALTER TABLE `employee_shift_assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `employee_shift_assignments_work_shift_id_foreign` (`work_shift_id`),
  ADD KEY `employee_shift_assignments_assigned_by_foreign` (`assigned_by`),
  ADD KEY `employee_shift_period_index` (`employee_id`,`effective_from`,`effective_to`);

--
-- Indexes for table `employee_terminations`
--
ALTER TABLE `employee_terminations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `employee_terminations_termination_number_unique` (`termination_number`),
  ADD UNIQUE KEY `employee_terminations_accounting_transaction_id_unique` (`accounting_transaction_id`),
  ADD KEY `employee_terminations_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `employee_terminations_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `employee_terminations_created_by_foreign` (`created_by`),
  ADD KEY `employee_terminations_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `employee_terminations_approved_by_foreign` (`approved_by`),
  ADD KEY `employee_terminations_rejected_by_foreign` (`rejected_by`),
  ADD KEY `employee_termination_status_index` (`employee_id`,`status`,`last_working_date`);

--
-- Indexes for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `failed_jobs_uuid_unique` (`uuid`);

--
-- Indexes for table `financial_categories`
--
ALTER TABLE `financial_categories`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `financial_categories_code_unique` (`code`);

--
-- Indexes for table `financial_period_closings`
--
ALTER TABLE `financial_period_closings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `financial_period_closings_period_code_unique` (`period_code`),
  ADD KEY `financial_period_closings_prepared_by_foreign` (`prepared_by`),
  ADD KEY `financial_period_closings_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `financial_period_closings_closed_by_foreign` (`closed_by`),
  ADD KEY `financial_period_closings_rejected_by_foreign` (`rejected_by`),
  ADD KEY `financial_period_closings_reopened_by_foreign` (`reopened_by`),
  ADD KEY `financial_period_closings_status_period_end_index` (`status`,`period_end`);

--
-- Indexes for table `goods`
--
ALTER TABLE `goods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `goods_code_unique` (`code`),
  ADD KEY `goods_code_index` (`code`),
  ADD KEY `goods_category_index` (`category`),
  ADD KEY `goods_status_index` (`status`);

--
-- Indexes for table `inventory_issues`
--
ALTER TABLE `inventory_issues`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `inventory_issues_issue_number_unique` (`issue_number`),
  ADD KEY `inventory_issues_requested_by_foreign` (`requested_by`),
  ADD KEY `inventory_issues_approved_by_foreign` (`approved_by`),
  ADD KEY `inventory_issues_customer_contract_id_foreign` (`customer_contract_id`),
  ADD KEY `inventory_issues_created_by_foreign` (`created_by`),
  ADD KEY `inventory_issues_issue_number_index` (`issue_number`),
  ADD KEY `inventory_issues_type_status_index` (`type`,`status`),
  ADD KEY `inventory_issues_customer_id_index` (`customer_id`),
  ADD KEY `inventory_issues_department_id_index` (`department_id`),
  ADD KEY `inventory_issues_accounting_transaction_id_foreign` (`accounting_transaction_id`),
  ADD KEY `inventory_issues_invoice_id_foreign` (`invoice_id`);

--
-- Indexes for table `inventory_issue_items`
--
ALTER TABLE `inventory_issue_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventory_issue_items_inventory_item_id_foreign` (`inventory_item_id`),
  ADD KEY `inventory_issue_items_inventory_issue_id_index` (`inventory_issue_id`);

--
-- Indexes for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `inventory_items_code_unique` (`code`),
  ADD KEY `inventory_items_supplier_id_foreign` (`supplier_id`),
  ADD KEY `inventory_items_warehouse_id_category_index` (`warehouse_id`,`category`),
  ADD KEY `inventory_items_code_index` (`code`),
  ADD KEY `inventory_items_good_id_foreign` (`good_id`);

--
-- Indexes for table `inventory_requests`
--
ALTER TABLE `inventory_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `inventory_requests_request_number_unique` (`request_number`),
  ADD KEY `inventory_requests_supplier_id_foreign` (`supplier_id`),
  ADD KEY `inventory_requests_customer_id_foreign` (`customer_id`),
  ADD KEY `inventory_requests_department_id_foreign` (`department_id`),
  ADD KEY `inventory_requests_warehouse_id_foreign` (`warehouse_id`),
  ADD KEY `inventory_requests_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `inventory_requests_requested_by_foreign` (`requested_by`),
  ADD KEY `inventory_requests_approved_by_foreign` (`approved_by`),
  ADD KEY `inventory_requests_status_type_index` (`status`,`type`),
  ADD KEY `inventory_requests_request_date_index` (`request_date`),
  ADD KEY `inventory_requests_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `inventory_requests_invoice_id_foreign` (`invoice_id`);

--
-- Indexes for table `inventory_request_items`
--
ALTER TABLE `inventory_request_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventory_request_items_inventory_request_id_foreign` (`inventory_request_id`),
  ADD KEY `inventory_request_items_good_id_foreign` (`good_id`),
  ADD KEY `inventory_request_items_inventory_item_id_foreign` (`inventory_item_id`);

--
-- Indexes for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `inventory_transactions_reference_type_reference_id_index` (`reference_type`,`reference_id`),
  ADD KEY `inventory_transactions_created_by_foreign` (`created_by`),
  ADD KEY `inventory_transactions_inventory_item_id_type_index` (`inventory_item_id`,`type`),
  ADD KEY `inventory_transactions_transaction_date_index` (`transaction_date`);

--
-- Indexes for table `invoices`
--
ALTER TABLE `invoices`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `invoices_invoice_number_unique` (`invoice_number`),
  ADD UNIQUE KEY `invoices_meter_reading_id_unique` (`meter_reading_id`),
  ADD UNIQUE KEY `invoices_source_unique` (`source_type`,`source_id`),
  ADD KEY `invoices_customer_id_status_index` (`customer_id`,`status`),
  ADD KEY `invoices_billing_period_id_status_index` (`billing_period_id`,`status`),
  ADD KEY `invoices_customer_contract_id_foreign` (`customer_contract_id`),
  ADD KEY `invoices_invoice_type_status_index` (`invoice_type`,`status`);

--
-- Indexes for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD PRIMARY KEY (`id`),
  ADD KEY `invoice_items_financial_category_id_foreign` (`financial_category_id`),
  ADD KEY `invoice_items_invoice_id_item_type_index` (`invoice_id`,`item_type`),
  ADD KEY `invoice_items_customer_charge_id_index` (`customer_charge_id`);

--
-- Indexes for table `jobs`
--
ALTER TABLE `jobs`
  ADD PRIMARY KEY (`id`),
  ADD KEY `jobs_queue_index` (`queue`);

--
-- Indexes for table `job_batches`
--
ALTER TABLE `job_batches`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `job_positions`
--
ALTER TABLE `job_positions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `job_positions_code_unique` (`code`),
  ADD KEY `job_positions_department_id_foreign` (`department_id`);

--
-- Indexes for table `leave_policies`
--
ALTER TABLE `leave_policies`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `leave_policies_code_unique` (`code`);

--
-- Indexes for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `leave_requests_leave_number_unique` (`leave_number`),
  ADD KEY `leave_requests_created_by_foreign` (`created_by`),
  ADD KEY `leave_requests_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `leave_requests_employee_id_start_date_end_date_index` (`employee_id`,`start_date`,`end_date`),
  ADD KEY `leave_requests_leave_policy_id_foreign` (`leave_policy_id`);

--
-- Indexes for table `meters`
--
ALTER TABLE `meters`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `meters_meter_number_unique` (`meter_number`),
  ADD KEY `meters_good_id_foreign` (`good_id`),
  ADD KEY `meters_purchase_request_item_id_foreign` (`purchase_request_item_id`),
  ADD KEY `meters_supplier_id_foreign` (`supplier_id`),
  ADD KEY `meters_source_warehouse_id_foreign` (`source_warehouse_id`),
  ADD KEY `meters_current_warehouse_status_index` (`current_warehouse_id`,`status`),
  ADD KEY `meters_inventory_item_status_index` (`inventory_item_id`,`status`);

--
-- Indexes for table `meter_assignments`
--
ALTER TABLE `meter_assignments`
  ADD PRIMARY KEY (`id`),
  ADD KEY `meter_assignments_installed_by_foreign` (`installed_by`),
  ADD KEY `meter_assignments_customer_id_status_index` (`customer_id`,`status`),
  ADD KEY `meter_assignments_meter_id_status_index` (`meter_id`,`status`),
  ADD KEY `meter_assignments_customer_contract_id_foreign` (`customer_contract_id`),
  ADD KEY `meter_assignments_source_warehouse_id_foreign` (`source_warehouse_id`),
  ADD KEY `meter_assignments_return_warehouse_id_foreign` (`return_warehouse_id`);

--
-- Indexes for table `meter_movements`
--
ALTER TABLE `meter_movements`
  ADD PRIMARY KEY (`id`),
  ADD KEY `meter_movements_from_warehouse_id_foreign` (`from_warehouse_id`),
  ADD KEY `meter_movements_meter_assignment_id_foreign` (`meter_assignment_id`),
  ADD KEY `meter_movements_inventory_transaction_id_foreign` (`inventory_transaction_id`),
  ADD KEY `meter_movements_created_by_foreign` (`created_by`),
  ADD KEY `meter_movements_meter_id_movement_date_index` (`meter_id`,`movement_date`),
  ADD KEY `meter_movements_to_warehouse_id_type_index` (`to_warehouse_id`,`type`),
  ADD KEY `meter_movements_customer_id_type_index` (`customer_id`,`type`);

--
-- Indexes for table `meter_readings`
--
ALTER TABLE `meter_readings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `meter_readings_billing_period_id_meter_assignment_id_unique` (`billing_period_id`,`meter_assignment_id`),
  ADD KEY `meter_readings_meter_assignment_id_foreign` (`meter_assignment_id`),
  ADD KEY `meter_readings_meter_id_foreign` (`meter_id`),
  ADD KEY `meter_readings_read_by_foreign` (`read_by`),
  ADD KEY `meter_readings_customer_id_billing_period_id_index` (`customer_id`,`billing_period_id`);

--
-- Indexes for table `meter_seals`
--
ALTER TABLE `meter_seals`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `meter_seals_seal_number_unique` (`seal_number`),
  ADD KEY `meter_seals_sealed_by_foreign` (`sealed_by`),
  ADD KEY `meter_seals_removed_by_foreign` (`removed_by`),
  ADD KEY `meter_seals_meter_assignment_id_status_index` (`meter_assignment_id`,`status`);

--
-- Indexes for table `migrations`
--
ALTER TABLE `migrations`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `model_has_permissions`
--
ALTER TABLE `model_has_permissions`
  ADD PRIMARY KEY (`permission_id`,`model_id`,`model_type`),
  ADD KEY `model_has_permissions_model_id_model_type_index` (`model_id`,`model_type`);

--
-- Indexes for table `model_has_roles`
--
ALTER TABLE `model_has_roles`
  ADD PRIMARY KEY (`role_id`,`model_id`,`model_type`),
  ADD KEY `model_has_roles_model_id_model_type_index` (`model_id`,`model_type`);

--
-- Indexes for table `notifications`
--
ALTER TABLE `notifications`
  ADD PRIMARY KEY (`id`),
  ADD KEY `notifications_notifiable_type_notifiable_id_index` (`notifiable_type`,`notifiable_id`);

--
-- Indexes for table `password_reset_tokens`
--
ALTER TABLE `password_reset_tokens`
  ADD PRIMARY KEY (`email`);

--
-- Indexes for table `payments`
--
ALTER TABLE `payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `payments_receipt_number_unique` (`receipt_number`),
  ADD UNIQUE KEY `payments_refund_receipt_number_unique` (`refund_receipt_number`),
  ADD KEY `payments_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `payments_received_by_foreign` (`received_by`),
  ADD KEY `payments_customer_id_paid_at_index` (`customer_id`,`paid_at`),
  ADD KEY `payments_invoice_id_status_index` (`invoice_id`,`status`),
  ADD KEY `payments_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `payments_customer_contract_id_foreign` (`customer_contract_id`),
  ADD KEY `payments_customer_deposit_id_foreign` (`customer_deposit_id`),
  ADD KEY `payments_refunded_by_foreign` (`refunded_by`),
  ADD KEY `payments_refund_transaction_id_foreign` (`refund_transaction_id`);

--
-- Indexes for table `payment_allocations`
--
ALTER TABLE `payment_allocations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `payment_allocations_payment_id_foreign` (`payment_id`),
  ADD KEY `payment_allocations_invoice_id_index` (`invoice_id`),
  ADD KEY `payment_allocations_customer_charge_id_index` (`customer_charge_id`),
  ADD KEY `payment_allocations_refunded_by_foreign` (`refunded_by`),
  ADD KEY `payment_allocations_refund_transaction_id_foreign` (`refund_transaction_id`);

--
-- Indexes for table `payment_methods`
--
ALTER TABLE `payment_methods`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `payment_methods_code_unique` (`code`);

--
-- Indexes for table `payroll_advance_allocations`
--
ALTER TABLE `payroll_advance_allocations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `payroll_advance_unique` (`payroll_item_id`,`salary_advance_id`),
  ADD KEY `payroll_advance_allocations_salary_advance_id_foreign` (`salary_advance_id`);

--
-- Indexes for table `payroll_deduction_allocations`
--
ALTER TABLE `payroll_deduction_allocations`
  ADD PRIMARY KEY (`id`),
  ADD KEY `payroll_deduction_allocations_payroll_item_id_foreign` (`payroll_item_id`),
  ADD KEY `payroll_alloc_employee_deduction_fk` (`employee_payroll_deduction_id`),
  ADD KEY `payroll_alloc_rule_fk` (`payroll_deduction_rule_id`);

--
-- Indexes for table `payroll_deduction_rules`
--
ALTER TABLE `payroll_deduction_rules`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `payroll_deduction_rules_code_unique` (`code`);

--
-- Indexes for table `payroll_items`
--
ALTER TABLE `payroll_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `payroll_items_payroll_run_id_user_id_unique` (`payroll_run_id`,`user_id`),
  ADD UNIQUE KEY `payroll_run_employee_unique` (`payroll_run_id`,`employee_id`),
  ADD KEY `payroll_items_user_id_foreign` (`user_id`),
  ADD KEY `payroll_items_employee_id_foreign` (`employee_id`);

--
-- Indexes for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `payroll_runs_payroll_number_unique` (`payroll_number`),
  ADD UNIQUE KEY `payroll_runs_accounting_transaction_id_unique` (`accounting_transaction_id`),
  ADD KEY `payroll_runs_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `payroll_runs_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `payroll_runs_financial_category_id_foreign` (`financial_category_id`),
  ADD KEY `payroll_runs_created_by_foreign` (`created_by`),
  ADD KEY `payroll_runs_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `payroll_runs_approved_by_foreign` (`approved_by`),
  ADD KEY `payroll_runs_rejected_by_foreign` (`rejected_by`),
  ADD KEY `payroll_runs_period_start_period_end_index` (`period_start`,`period_end`),
  ADD KEY `payroll_runs_status_payment_date_index` (`status`,`payment_date`);

--
-- Indexes for table `performance_reviews`
--
ALTER TABLE `performance_reviews`
  ADD PRIMARY KEY (`id`),
  ADD KEY `performance_reviews_employee_id_foreign` (`employee_id`),
  ADD KEY `performance_reviews_reviewed_by_foreign` (`reviewed_by`);

--
-- Indexes for table `permissions`
--
ALTER TABLE `permissions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `permissions_name_guard_name_unique` (`name`,`guard_name`);

--
-- Indexes for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `personal_access_tokens_token_unique` (`token`),
  ADD KEY `personal_access_tokens_tokenable_type_tokenable_id_index` (`tokenable_type`,`tokenable_id`),
  ADD KEY `personal_access_tokens_expires_at_index` (`expires_at`);

--
-- Indexes for table `public_holidays`
--
ALTER TABLE `public_holidays`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `public_holidays_holiday_date_unique` (`holiday_date`);

--
-- Indexes for table `roles`
--
ALTER TABLE `roles`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `roles_name_guard_name_unique` (`name`,`guard_name`);

--
-- Indexes for table `role_has_permissions`
--
ALTER TABLE `role_has_permissions`
  ADD PRIMARY KEY (`permission_id`,`role_id`),
  ADD KEY `role_has_permissions_role_id_foreign` (`role_id`);

--
-- Indexes for table `salary_advances`
--
ALTER TABLE `salary_advances`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `salary_advances_advance_number_unique` (`advance_number`),
  ADD KEY `salary_advances_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `salary_advances_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `salary_advances_accounting_transaction_id_foreign` (`accounting_transaction_id`),
  ADD KEY `salary_advances_created_by_foreign` (`created_by`),
  ADD KEY `salary_advances_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `salary_advances_approved_by_foreign` (`approved_by`),
  ADD KEY `salary_advances_rejected_by_foreign` (`rejected_by`),
  ADD KEY `salary_advances_employee_id_status_deduction_start_date_index` (`employee_id`,`status`,`deduction_start_date`);

--
-- Indexes for table `service_areas`
--
ALTER TABLE `service_areas`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `sessions`
--
ALTER TABLE `sessions`
  ADD PRIMARY KEY (`id`),
  ADD KEY `sessions_user_id_index` (`user_id`),
  ADD KEY `sessions_last_activity_index` (`last_activity`);

--
-- Indexes for table `shareholders`
--
ALTER TABLE `shareholders`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `shareholders_shareholder_number_unique` (`shareholder_number`),
  ADD KEY `shareholders_status_ownership_percentage_index` (`status`,`ownership_percentage`);

--
-- Indexes for table `shareholder_distributions`
--
ALTER TABLE `shareholder_distributions`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `shareholder_distributions_financial_period_closing_id_unique` (`financial_period_closing_id`),
  ADD UNIQUE KEY `shareholder_distributions_distribution_number_unique` (`distribution_number`),
  ADD KEY `shareholder_distributions_created_by_foreign` (`created_by`),
  ADD KEY `shareholder_distributions_reviewed_by_foreign` (`reviewed_by`),
  ADD KEY `shareholder_distributions_approved_by_foreign` (`approved_by`),
  ADD KEY `shareholder_distributions_rejected_by_foreign` (`rejected_by`);

--
-- Indexes for table `shareholder_distribution_items`
--
ALTER TABLE `shareholder_distribution_items`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `shareholder_distribution_item_unique` (`shareholder_distribution_id`,`shareholder_id`),
  ADD KEY `shareholder_distribution_items_shareholder_id_foreign` (`shareholder_id`);

--
-- Indexes for table `shareholder_payments`
--
ALTER TABLE `shareholder_payments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `shareholder_payments_payment_number_unique` (`payment_number`),
  ADD UNIQUE KEY `shareholder_payments_accounting_transaction_id_unique` (`accounting_transaction_id`),
  ADD KEY `shareholder_payments_item_fk` (`shareholder_distribution_item_id`),
  ADD KEY `shareholder_payments_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `shareholder_payments_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `shareholder_payments_created_by_foreign` (`created_by`),
  ADD KEY `shareholder_payments_status_payment_date_index` (`status`,`payment_date`);

--
-- Indexes for table `suppliers`
--
ALTER TABLE `suppliers`
  ADD PRIMARY KEY (`id`);

--
-- Indexes for table `supplier_installments`
--
ALTER TABLE `supplier_installments`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `supplier_installment_number_unique` (`supplier_purchase_contract_id`,`installment_number`),
  ADD KEY `supplier_installments_payment_method_id_foreign` (`payment_method_id`),
  ADD KEY `supplier_installments_accounting_account_id_foreign` (`accounting_account_id`),
  ADD KEY `supplier_installments_recorded_by_foreign` (`recorded_by`),
  ADD KEY `supplier_installments_due_date_status_index` (`due_date`,`status`),
  ADD KEY `supplier_installments_accounting_transaction_id_foreign` (`accounting_transaction_id`);

--
-- Indexes for table `supplier_purchase_contracts`
--
ALTER TABLE `supplier_purchase_contracts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `supplier_purchase_contracts_contract_number_unique` (`contract_number`),
  ADD KEY `supplier_purchase_contracts_financial_category_id_foreign` (`financial_category_id`),
  ADD KEY `supplier_purchase_contracts_created_by_foreign` (`created_by`),
  ADD KEY `supplier_purchase_contracts_supplier_id_status_index` (`supplier_id`,`status`),
  ADD KEY `supplier_purchase_contracts_next_payment_date_status_index` (`next_payment_date`,`status`);

--
-- Indexes for table `system_settings`
--
ALTER TABLE `system_settings`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `system_settings_key_unique` (`key`);

--
-- Indexes for table `termination_advance_allocations`
--
ALTER TABLE `termination_advance_allocations`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `termination_advance_unique` (`employee_termination_id`,`salary_advance_id`),
  ADD KEY `termination_advance_allocations_salary_advance_id_foreign` (`salary_advance_id`);

--
-- Indexes for table `users`
--
ALTER TABLE `users`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `users_email_unique` (`email`);

--
-- Indexes for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `warehouses_code_unique` (`code`),
  ADD KEY `warehouses_service_area_id_foreign` (`service_area_id`),
  ADD KEY `warehouses_code_index` (`code`),
  ADD KEY `warehouses_status_index` (`status`);

--
-- Indexes for table `work_shifts`
--
ALTER TABLE `work_shifts`
  ADD PRIMARY KEY (`id`),
  ADD UNIQUE KEY `work_shifts_code_unique` (`code`);

--
-- AUTO_INCREMENT for dumped tables
--

--
-- AUTO_INCREMENT for table `accounting_accounts`
--
ALTER TABLE `accounting_accounts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `accounting_transactions`
--
ALTER TABLE `accounting_transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=43;

--
-- AUTO_INCREMENT for table `account_reconciliations`
--
ALTER TABLE `account_reconciliations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=28;

--
-- AUTO_INCREMENT for table `account_reconciliation_items`
--
ALTER TABLE `account_reconciliation_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `assets`
--
ALTER TABLE `assets`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `asset_maintenance`
--
ALTER TABLE `asset_maintenance`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `asset_purchases`
--
ALTER TABLE `asset_purchases`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `attendance_records`
--
ALTER TABLE `attendance_records`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=140;

--
-- AUTO_INCREMENT for table `billing_periods`
--
ALTER TABLE `billing_periods`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `biometric_import_batches`
--
ALTER TABLE `biometric_import_batches`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `customers`
--
ALTER TABLE `customers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `customer_charges`
--
ALTER TABLE `customer_charges`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `customer_charge_types`
--
ALTER TABLE `customer_charge_types`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `customer_connection_events`
--
ALTER TABLE `customer_connection_events`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `customer_contracts`
--
ALTER TABLE `customer_contracts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `customer_deposits`
--
ALTER TABLE `customer_deposits`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_deposit_allocations`
--
ALTER TABLE `customer_deposit_allocations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `customer_documents`
--
ALTER TABLE `customer_documents`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `customer_service_requests`
--
ALTER TABLE `customer_service_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `departments`
--
ALTER TABLE `departments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `employees`
--
ALTER TABLE `employees`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `employee_adjustments`
--
ALTER TABLE `employee_adjustments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `employee_documents`
--
ALTER TABLE `employee_documents`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `employee_leave_balances`
--
ALTER TABLE `employee_leave_balances`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=30;

--
-- AUTO_INCREMENT for table `employee_payroll_deductions`
--
ALTER TABLE `employee_payroll_deductions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `employee_shift_assignments`
--
ALTER TABLE `employee_shift_assignments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `employee_terminations`
--
ALTER TABLE `employee_terminations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `failed_jobs`
--
ALTER TABLE `failed_jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `financial_categories`
--
ALTER TABLE `financial_categories`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `financial_period_closings`
--
ALTER TABLE `financial_period_closings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `goods`
--
ALTER TABLE `goods`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `inventory_issues`
--
ALTER TABLE `inventory_issues`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_issue_items`
--
ALTER TABLE `inventory_issue_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `inventory_items`
--
ALTER TABLE `inventory_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `inventory_requests`
--
ALTER TABLE `inventory_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `inventory_request_items`
--
ALTER TABLE `inventory_request_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `invoices`
--
ALTER TABLE `invoices`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=17;

--
-- AUTO_INCREMENT for table `invoice_items`
--
ALTER TABLE `invoice_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=22;

--
-- AUTO_INCREMENT for table `jobs`
--
ALTER TABLE `jobs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `job_positions`
--
ALTER TABLE `job_positions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `leave_policies`
--
ALTER TABLE `leave_policies`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `leave_requests`
--
ALTER TABLE `leave_requests`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `meters`
--
ALTER TABLE `meters`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `meter_assignments`
--
ALTER TABLE `meter_assignments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `meter_movements`
--
ALTER TABLE `meter_movements`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=9;

--
-- AUTO_INCREMENT for table `meter_readings`
--
ALTER TABLE `meter_readings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `meter_seals`
--
ALTER TABLE `meter_seals`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `migrations`
--
ALTER TABLE `migrations`
  MODIFY `id` int(10) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=51;

--
-- AUTO_INCREMENT for table `payments`
--
ALTER TABLE `payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `payment_allocations`
--
ALTER TABLE `payment_allocations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=16;

--
-- AUTO_INCREMENT for table `payment_methods`
--
ALTER TABLE `payment_methods`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=6;

--
-- AUTO_INCREMENT for table `payroll_advance_allocations`
--
ALTER TABLE `payroll_advance_allocations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `payroll_deduction_allocations`
--
ALTER TABLE `payroll_deduction_allocations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `payroll_deduction_rules`
--
ALTER TABLE `payroll_deduction_rules`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `payroll_items`
--
ALTER TABLE `payroll_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=8;

--
-- AUTO_INCREMENT for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `performance_reviews`
--
ALTER TABLE `performance_reviews`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `permissions`
--
ALTER TABLE `permissions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=172;

--
-- AUTO_INCREMENT for table `personal_access_tokens`
--
ALTER TABLE `personal_access_tokens`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=7;

--
-- AUTO_INCREMENT for table `public_holidays`
--
ALTER TABLE `public_holidays`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `roles`
--
ALTER TABLE `roles`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `salary_advances`
--
ALTER TABLE `salary_advances`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `service_areas`
--
ALTER TABLE `service_areas`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=5;

--
-- AUTO_INCREMENT for table `shareholders`
--
ALTER TABLE `shareholders`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `shareholder_distributions`
--
ALTER TABLE `shareholder_distributions`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `shareholder_distribution_items`
--
ALTER TABLE `shareholder_distribution_items`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=10;

--
-- AUTO_INCREMENT for table `shareholder_payments`
--
ALTER TABLE `shareholder_payments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `suppliers`
--
ALTER TABLE `suppliers`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `supplier_installments`
--
ALTER TABLE `supplier_installments`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `supplier_purchase_contracts`
--
ALTER TABLE `supplier_purchase_contracts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT;

--
-- AUTO_INCREMENT for table `system_settings`
--
ALTER TABLE `system_settings`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `termination_advance_allocations`
--
ALTER TABLE `termination_advance_allocations`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=2;

--
-- AUTO_INCREMENT for table `users`
--
ALTER TABLE `users`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=11;

--
-- AUTO_INCREMENT for table `warehouses`
--
ALTER TABLE `warehouses`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- AUTO_INCREMENT for table `work_shifts`
--
ALTER TABLE `work_shifts`
  MODIFY `id` bigint(20) UNSIGNED NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;

--
-- Constraints for dumped tables
--

--
-- Constraints for table `accounting_transactions`
--
ALTER TABLE `accounting_transactions`
  ADD CONSTRAINT `accounting_transactions_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_financial_category_id_foreign` FOREIGN KEY (`financial_category_id`) REFERENCES `financial_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_recorded_by_foreign` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `accounting_transactions_supplier_installment_id_foreign` FOREIGN KEY (`supplier_installment_id`) REFERENCES `supplier_installments` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `account_reconciliations`
--
ALTER TABLE `account_reconciliations`
  ADD CONSTRAINT `account_reconciliations_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`),
  ADD CONSTRAINT `account_reconciliations_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `account_reconciliations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `account_reconciliations_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `account_reconciliations_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `account_reconciliation_items`
--
ALTER TABLE `account_reconciliation_items`
  ADD CONSTRAINT `reconciliation_items_parent_fk` FOREIGN KEY (`account_reconciliation_id`) REFERENCES `account_reconciliations` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `assets`
--
ALTER TABLE `assets`
  ADD CONSTRAINT `assets_asset_purchase_id_foreign` FOREIGN KEY (`asset_purchase_id`) REFERENCES `asset_purchases` (`id`),
  ADD CONSTRAINT `assets_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `assets_service_area_id_foreign` FOREIGN KEY (`service_area_id`) REFERENCES `service_areas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `assets_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `asset_maintenance`
--
ALTER TABLE `asset_maintenance`
  ADD CONSTRAINT `asset_maintenance_asset_id_foreign` FOREIGN KEY (`asset_id`) REFERENCES `assets` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `asset_maintenance_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `asset_purchases`
--
ALTER TABLE `asset_purchases`
  ADD CONSTRAINT `asset_purchases_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`),
  ADD CONSTRAINT `asset_purchases_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_purchases_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_purchases_financial_category_id_foreign` FOREIGN KEY (`financial_category_id`) REFERENCES `financial_categories` (`id`),
  ADD CONSTRAINT `asset_purchases_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  ADD CONSTRAINT `asset_purchases_service_area_id_foreign` FOREIGN KEY (`service_area_id`) REFERENCES `service_areas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `asset_purchases_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `attendance_records`
--
ALTER TABLE `attendance_records`
  ADD CONSTRAINT `attendance_records_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `attendance_records_biometric_import_batch_id_foreign` FOREIGN KEY (`biometric_import_batch_id`) REFERENCES `biometric_import_batches` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `attendance_records_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `attendance_records_leave_request_id_foreign` FOREIGN KEY (`leave_request_id`) REFERENCES `leave_requests` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `attendance_records_recorded_by_foreign` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `biometric_import_batches`
--
ALTER TABLE `biometric_import_batches`
  ADD CONSTRAINT `biometric_import_batches_imported_by_foreign` FOREIGN KEY (`imported_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `customers`
--
ALTER TABLE `customers`
  ADD CONSTRAINT `customers_agreement_accounting_account_id_foreign` FOREIGN KEY (`agreement_accounting_account_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customers_agreement_payment_id_foreign` FOREIGN KEY (`agreement_payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customers_agreement_payment_method_id_foreign` FOREIGN KEY (`agreement_payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customers_agreement_payment_received_by_foreign` FOREIGN KEY (`agreement_payment_received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customers_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customers_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customers_service_area_id_foreign` FOREIGN KEY (`service_area_id`) REFERENCES `service_areas` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `customer_charges`
--
ALTER TABLE `customer_charges`
  ADD CONSTRAINT `customer_charges_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_charges_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_charges_customer_charge_type_id_foreign` FOREIGN KEY (`customer_charge_type_id`) REFERENCES `customer_charge_types` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_charges_customer_contract_id_foreign` FOREIGN KEY (`customer_contract_id`) REFERENCES `customer_contracts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_charges_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_charges_financial_category_id_foreign` FOREIGN KEY (`financial_category_id`) REFERENCES `financial_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_charges_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_connection_events`
--
ALTER TABLE `customer_connection_events`
  ADD CONSTRAINT `customer_connection_events_customer_charge_id_foreign` FOREIGN KEY (`customer_charge_id`) REFERENCES `customer_charges` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_connection_events_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_connection_events_processed_by_foreign` FOREIGN KEY (`processed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_contracts`
--
ALTER TABLE `customer_contracts`
  ADD CONSTRAINT `customer_contracts_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_contracts_confirmed_by_foreign` FOREIGN KEY (`confirmed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_contracts_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_contracts_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_contracts_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_contracts_submitted_by_foreign` FOREIGN KEY (`submitted_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_contracts_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_deposits`
--
ALTER TABLE `customer_deposits`
  ADD CONSTRAINT `customer_deposits_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_deposits_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_deposits_applied_by_foreign` FOREIGN KEY (`applied_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_deposits_customer_contract_id_foreign` FOREIGN KEY (`customer_contract_id`) REFERENCES `customer_contracts` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_deposits_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_deposits_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_deposits_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_deposits_received_by_foreign` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_deposits_refund_transaction_id_foreign` FOREIGN KEY (`refund_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_deposits_refunded_by_foreign` FOREIGN KEY (`refunded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_deposit_allocations`
--
ALTER TABLE `customer_deposit_allocations`
  ADD CONSTRAINT `customer_deposit_allocations_customer_charge_id_foreign` FOREIGN KEY (`customer_charge_id`) REFERENCES `customer_charges` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_deposit_allocations_customer_deposit_id_foreign` FOREIGN KEY (`customer_deposit_id`) REFERENCES `customer_deposits` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `customer_documents`
--
ALTER TABLE `customer_documents`
  ADD CONSTRAINT `customer_documents_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `customer_documents_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `customer_service_requests`
--
ALTER TABLE `customer_service_requests`
  ADD CONSTRAINT `customer_service_requests_assigned_to_foreign` FOREIGN KEY (`assigned_to`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_service_requests_closed_by_foreign` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_service_requests_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `customer_service_requests_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `employees`
--
ALTER TABLE `employees`
  ADD CONSTRAINT `employees_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employees_job_position_id_foreign` FOREIGN KEY (`job_position_id`) REFERENCES `job_positions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employees_referred_by_shareholder_id_foreign` FOREIGN KEY (`referred_by_shareholder_id`) REFERENCES `shareholders` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employees_service_area_id_foreign` FOREIGN KEY (`service_area_id`) REFERENCES `service_areas` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employees_updated_by_foreign` FOREIGN KEY (`updated_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employees_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employee_adjustments`
--
ALTER TABLE `employee_adjustments`
  ADD CONSTRAINT `employee_adjustments_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_adjustments_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_adjustments_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `employee_adjustments_payroll_item_id_foreign` FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employee_documents`
--
ALTER TABLE `employee_documents`
  ADD CONSTRAINT `employee_documents_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `employee_documents_uploaded_by_foreign` FOREIGN KEY (`uploaded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `employee_leave_balances`
--
ALTER TABLE `employee_leave_balances`
  ADD CONSTRAINT `employee_leave_balances_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `employee_leave_balances_leave_policy_id_foreign` FOREIGN KEY (`leave_policy_id`) REFERENCES `leave_policies` (`id`);

--
-- Constraints for table `employee_payroll_deductions`
--
ALTER TABLE `employee_payroll_deductions`
  ADD CONSTRAINT `employee_deduction_rule_fk` FOREIGN KEY (`payroll_deduction_rule_id`) REFERENCES `payroll_deduction_rules` (`id`),
  ADD CONSTRAINT `employee_payroll_deductions_assigned_by_foreign` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_payroll_deductions_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `employee_shift_assignments`
--
ALTER TABLE `employee_shift_assignments`
  ADD CONSTRAINT `employee_shift_assignments_assigned_by_foreign` FOREIGN KEY (`assigned_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_shift_assignments_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `employee_shift_assignments_work_shift_id_foreign` FOREIGN KEY (`work_shift_id`) REFERENCES `work_shifts` (`id`);

--
-- Constraints for table `employee_terminations`
--
ALTER TABLE `employee_terminations`
  ADD CONSTRAINT `employee_terminations_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`),
  ADD CONSTRAINT `employee_terminations_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_terminations_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_terminations_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_terminations_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `employee_terminations_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  ADD CONSTRAINT `employee_terminations_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `employee_terminations_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `financial_period_closings`
--
ALTER TABLE `financial_period_closings`
  ADD CONSTRAINT `financial_period_closings_closed_by_foreign` FOREIGN KEY (`closed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `financial_period_closings_prepared_by_foreign` FOREIGN KEY (`prepared_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `financial_period_closings_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `financial_period_closings_reopened_by_foreign` FOREIGN KEY (`reopened_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `financial_period_closings_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `inventory_issues`
--
ALTER TABLE `inventory_issues`
  ADD CONSTRAINT `inventory_issues_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_issues_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_issues_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_issues_customer_contract_id_foreign` FOREIGN KEY (`customer_contract_id`) REFERENCES `customer_contracts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_issues_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_issues_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_issues_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_issues_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `inventory_issue_items`
--
ALTER TABLE `inventory_issue_items`
  ADD CONSTRAINT `inventory_issue_items_inventory_issue_id_foreign` FOREIGN KEY (`inventory_issue_id`) REFERENCES `inventory_issues` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_issue_items_inventory_item_id_foreign` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_items`
--
ALTER TABLE `inventory_items`
  ADD CONSTRAINT `inventory_items_good_id_foreign` FOREIGN KEY (`good_id`) REFERENCES `goods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_items_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_items_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_requests`
--
ALTER TABLE `inventory_requests`
  ADD CONSTRAINT `inventory_requests_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_requests_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_requests_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_requests_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_requests_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_requests_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_requests_requested_by_foreign` FOREIGN KEY (`requested_by`) REFERENCES `users` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `inventory_requests_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_requests_warehouse_id_foreign` FOREIGN KEY (`warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `inventory_request_items`
--
ALTER TABLE `inventory_request_items`
  ADD CONSTRAINT `inventory_request_items_good_id_foreign` FOREIGN KEY (`good_id`) REFERENCES `goods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_request_items_inventory_item_id_foreign` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_request_items_inventory_request_id_foreign` FOREIGN KEY (`inventory_request_id`) REFERENCES `inventory_requests` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `inventory_transactions`
--
ALTER TABLE `inventory_transactions`
  ADD CONSTRAINT `inventory_transactions_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `inventory_transactions_inventory_item_id_foreign` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `invoices`
--
ALTER TABLE `invoices`
  ADD CONSTRAINT `invoices_billing_period_id_foreign` FOREIGN KEY (`billing_period_id`) REFERENCES `billing_periods` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `invoices_customer_contract_id_foreign` FOREIGN KEY (`customer_contract_id`) REFERENCES `customer_contracts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `invoices_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `invoices_meter_reading_id_foreign` FOREIGN KEY (`meter_reading_id`) REFERENCES `meter_readings` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `invoice_items`
--
ALTER TABLE `invoice_items`
  ADD CONSTRAINT `invoice_items_customer_charge_id_foreign` FOREIGN KEY (`customer_charge_id`) REFERENCES `customer_charges` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `invoice_items_financial_category_id_foreign` FOREIGN KEY (`financial_category_id`) REFERENCES `financial_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `invoice_items_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `job_positions`
--
ALTER TABLE `job_positions`
  ADD CONSTRAINT `job_positions_department_id_foreign` FOREIGN KEY (`department_id`) REFERENCES `departments` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `leave_requests`
--
ALTER TABLE `leave_requests`
  ADD CONSTRAINT `leave_requests_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `leave_requests_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `leave_requests_leave_policy_id_foreign` FOREIGN KEY (`leave_policy_id`) REFERENCES `leave_policies` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `leave_requests_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `meters`
--
ALTER TABLE `meters`
  ADD CONSTRAINT `meters_current_warehouse_id_foreign` FOREIGN KEY (`current_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meters_good_id_foreign` FOREIGN KEY (`good_id`) REFERENCES `goods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meters_inventory_item_id_foreign` FOREIGN KEY (`inventory_item_id`) REFERENCES `inventory_items` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meters_purchase_request_item_id_foreign` FOREIGN KEY (`purchase_request_item_id`) REFERENCES `inventory_request_items` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meters_source_warehouse_id_foreign` FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meters_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `meter_assignments`
--
ALTER TABLE `meter_assignments`
  ADD CONSTRAINT `meter_assignments_customer_contract_id_foreign` FOREIGN KEY (`customer_contract_id`) REFERENCES `customer_contracts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_assignments_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `meter_assignments_installed_by_foreign` FOREIGN KEY (`installed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_assignments_meter_id_foreign` FOREIGN KEY (`meter_id`) REFERENCES `meters` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `meter_assignments_return_warehouse_id_foreign` FOREIGN KEY (`return_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_assignments_source_warehouse_id_foreign` FOREIGN KEY (`source_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `meter_movements`
--
ALTER TABLE `meter_movements`
  ADD CONSTRAINT `meter_movements_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_movements_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_movements_from_warehouse_id_foreign` FOREIGN KEY (`from_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_movements_inventory_transaction_id_foreign` FOREIGN KEY (`inventory_transaction_id`) REFERENCES `inventory_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_movements_meter_assignment_id_foreign` FOREIGN KEY (`meter_assignment_id`) REFERENCES `meter_assignments` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_movements_meter_id_foreign` FOREIGN KEY (`meter_id`) REFERENCES `meters` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `meter_movements_to_warehouse_id_foreign` FOREIGN KEY (`to_warehouse_id`) REFERENCES `warehouses` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `meter_readings`
--
ALTER TABLE `meter_readings`
  ADD CONSTRAINT `meter_readings_billing_period_id_foreign` FOREIGN KEY (`billing_period_id`) REFERENCES `billing_periods` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `meter_readings_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `meter_readings_meter_assignment_id_foreign` FOREIGN KEY (`meter_assignment_id`) REFERENCES `meter_assignments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `meter_readings_meter_id_foreign` FOREIGN KEY (`meter_id`) REFERENCES `meters` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `meter_readings_read_by_foreign` FOREIGN KEY (`read_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `meter_seals`
--
ALTER TABLE `meter_seals`
  ADD CONSTRAINT `meter_seals_meter_assignment_id_foreign` FOREIGN KEY (`meter_assignment_id`) REFERENCES `meter_assignments` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `meter_seals_removed_by_foreign` FOREIGN KEY (`removed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `meter_seals_sealed_by_foreign` FOREIGN KEY (`sealed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `model_has_permissions`
--
ALTER TABLE `model_has_permissions`
  ADD CONSTRAINT `model_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `model_has_roles`
--
ALTER TABLE `model_has_roles`
  ADD CONSTRAINT `model_has_roles_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payments`
--
ALTER TABLE `payments`
  ADD CONSTRAINT `payments_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payments_customer_contract_id_foreign` FOREIGN KEY (`customer_contract_id`) REFERENCES `customer_contracts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payments_customer_deposit_id_foreign` FOREIGN KEY (`customer_deposit_id`) REFERENCES `customer_deposits` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payments_customer_id_foreign` FOREIGN KEY (`customer_id`) REFERENCES `customers` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `payments_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `payments_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `payments_received_by_foreign` FOREIGN KEY (`received_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payments_refund_transaction_id_foreign` FOREIGN KEY (`refund_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payments_refunded_by_foreign` FOREIGN KEY (`refunded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payment_allocations`
--
ALTER TABLE `payment_allocations`
  ADD CONSTRAINT `payment_allocations_customer_charge_id_foreign` FOREIGN KEY (`customer_charge_id`) REFERENCES `customer_charges` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `payment_allocations_invoice_id_foreign` FOREIGN KEY (`invoice_id`) REFERENCES `invoices` (`id`) ON UPDATE CASCADE,
  ADD CONSTRAINT `payment_allocations_payment_id_foreign` FOREIGN KEY (`payment_id`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT `payment_allocations_refund_transaction_id_foreign` FOREIGN KEY (`refund_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payment_allocations_refunded_by_foreign` FOREIGN KEY (`refunded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payroll_advance_allocations`
--
ALTER TABLE `payroll_advance_allocations`
  ADD CONSTRAINT `payroll_advance_allocations_payroll_item_id_foreign` FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payroll_advance_allocations_salary_advance_id_foreign` FOREIGN KEY (`salary_advance_id`) REFERENCES `salary_advances` (`id`);

--
-- Constraints for table `payroll_deduction_allocations`
--
ALTER TABLE `payroll_deduction_allocations`
  ADD CONSTRAINT `payroll_alloc_employee_deduction_fk` FOREIGN KEY (`employee_payroll_deduction_id`) REFERENCES `employee_payroll_deductions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_alloc_rule_fk` FOREIGN KEY (`payroll_deduction_rule_id`) REFERENCES `payroll_deduction_rules` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_deduction_allocations_payroll_item_id_foreign` FOREIGN KEY (`payroll_item_id`) REFERENCES `payroll_items` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `payroll_items`
--
ALTER TABLE `payroll_items`
  ADD CONSTRAINT `payroll_items_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_items_payroll_run_id_foreign` FOREIGN KEY (`payroll_run_id`) REFERENCES `payroll_runs` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `payroll_items_user_id_foreign` FOREIGN KEY (`user_id`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `payroll_runs`
--
ALTER TABLE `payroll_runs`
  ADD CONSTRAINT `payroll_runs_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_runs_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_runs_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_runs_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_runs_financial_category_id_foreign` FOREIGN KEY (`financial_category_id`) REFERENCES `financial_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_runs_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_runs_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `payroll_runs_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `performance_reviews`
--
ALTER TABLE `performance_reviews`
  ADD CONSTRAINT `performance_reviews_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `performance_reviews_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `role_has_permissions`
--
ALTER TABLE `role_has_permissions`
  ADD CONSTRAINT `role_has_permissions_permission_id_foreign` FOREIGN KEY (`permission_id`) REFERENCES `permissions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `role_has_permissions_role_id_foreign` FOREIGN KEY (`role_id`) REFERENCES `roles` (`id`) ON DELETE CASCADE;

--
-- Constraints for table `salary_advances`
--
ALTER TABLE `salary_advances`
  ADD CONSTRAINT `salary_advances_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`),
  ADD CONSTRAINT `salary_advances_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `salary_advances_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `salary_advances_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `salary_advances_employee_id_foreign` FOREIGN KEY (`employee_id`) REFERENCES `employees` (`id`),
  ADD CONSTRAINT `salary_advances_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`),
  ADD CONSTRAINT `salary_advances_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `salary_advances_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `shareholder_distributions`
--
ALTER TABLE `shareholder_distributions`
  ADD CONSTRAINT `shareholder_distributions_approved_by_foreign` FOREIGN KEY (`approved_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `shareholder_distributions_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `shareholder_distributions_financial_period_closing_id_foreign` FOREIGN KEY (`financial_period_closing_id`) REFERENCES `financial_period_closings` (`id`),
  ADD CONSTRAINT `shareholder_distributions_rejected_by_foreign` FOREIGN KEY (`rejected_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `shareholder_distributions_reviewed_by_foreign` FOREIGN KEY (`reviewed_by`) REFERENCES `users` (`id`) ON DELETE SET NULL;

--
-- Constraints for table `shareholder_distribution_items`
--
ALTER TABLE `shareholder_distribution_items`
  ADD CONSTRAINT `distribution_items_distribution_fk` FOREIGN KEY (`shareholder_distribution_id`) REFERENCES `shareholder_distributions` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `shareholder_distribution_items_shareholder_id_foreign` FOREIGN KEY (`shareholder_id`) REFERENCES `shareholders` (`id`);

--
-- Constraints for table `shareholder_payments`
--
ALTER TABLE `shareholder_payments`
  ADD CONSTRAINT `shareholder_payments_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`),
  ADD CONSTRAINT `shareholder_payments_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `shareholder_payments_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `shareholder_payments_item_fk` FOREIGN KEY (`shareholder_distribution_item_id`) REFERENCES `shareholder_distribution_items` (`id`),
  ADD CONSTRAINT `shareholder_payments_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`);

--
-- Constraints for table `supplier_installments`
--
ALTER TABLE `supplier_installments`
  ADD CONSTRAINT `supplier_installments_accounting_account_id_foreign` FOREIGN KEY (`accounting_account_id`) REFERENCES `accounting_accounts` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `supplier_installments_accounting_transaction_id_foreign` FOREIGN KEY (`accounting_transaction_id`) REFERENCES `accounting_transactions` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `supplier_installments_payment_method_id_foreign` FOREIGN KEY (`payment_method_id`) REFERENCES `payment_methods` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `supplier_installments_recorded_by_foreign` FOREIGN KEY (`recorded_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `supplier_installments_supplier_purchase_contract_id_foreign` FOREIGN KEY (`supplier_purchase_contract_id`) REFERENCES `supplier_purchase_contracts` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;

--
-- Constraints for table `supplier_purchase_contracts`
--
ALTER TABLE `supplier_purchase_contracts`
  ADD CONSTRAINT `supplier_purchase_contracts_created_by_foreign` FOREIGN KEY (`created_by`) REFERENCES `users` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `supplier_purchase_contracts_financial_category_id_foreign` FOREIGN KEY (`financial_category_id`) REFERENCES `financial_categories` (`id`) ON DELETE SET NULL,
  ADD CONSTRAINT `supplier_purchase_contracts_supplier_id_foreign` FOREIGN KEY (`supplier_id`) REFERENCES `suppliers` (`id`) ON UPDATE CASCADE;

--
-- Constraints for table `termination_advance_allocations`
--
ALTER TABLE `termination_advance_allocations`
  ADD CONSTRAINT `termination_advance_allocations_employee_termination_id_foreign` FOREIGN KEY (`employee_termination_id`) REFERENCES `employee_terminations` (`id`) ON DELETE CASCADE,
  ADD CONSTRAINT `termination_advance_allocations_salary_advance_id_foreign` FOREIGN KEY (`salary_advance_id`) REFERENCES `salary_advances` (`id`);

--
-- Constraints for table `warehouses`
--
ALTER TABLE `warehouses`
  ADD CONSTRAINT `warehouses_service_area_id_foreign` FOREIGN KEY (`service_area_id`) REFERENCES `service_areas` (`id`) ON DELETE SET NULL;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
