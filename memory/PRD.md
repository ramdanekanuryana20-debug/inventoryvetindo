# PRD — VetStock (Sistem Stock Barang & Penjualan)

## Original Problem Statement
Sistem untuk stock barang (nama produk, qty, harga modal, modal/qty, dll sesuai gambar) dan penjualan (tanggal, nama barang, qty, harga, total, grand total) untuk mempermudah pekerjaan admin. Bahasa Indonesia.

## Architecture
- Backend: FastAPI + MongoDB (motor), JWT auth (bcrypt), openpyxl for Excel export.
- Frontend: React 19 + Tailwind + shadcn/ui, Manrope/IBM Plex Sans, forest-green theme.

## User Personas
- Admin apotek/klinik hewan: mengelola stock dan mencatat penjualan harian.

## Core Requirements (static)
- Login admin (JWT).
- Stock: Nama Produk, QTY, Harga Modal, Modal/QTY (=Harga Modal/QTY), Stock, Modal/Fisik (=Modal/QTY×Stock), Total Modal (jumlah semua Modal/Fisik), Keterangan.
- Penjualan: 1 transaksi = 1 tanggal + banyak baris barang (produk, qty, harga, total) + grand total.
- Stock otomatis berkurang saat penjualan.
- Export Excel untuk stock & penjualan.

## Implemented (2026-08-22)
- JWT auth + admin seed (ramdanekanuryana20@gmail.com).
- Dashboard: Total Modal, Total Produk, Stock Habis, Total Penjualan, Jumlah Transaksi, Penjualan Hari Ini.
- Inventory CRUD + search + computed columns + Total Modal footer + Excel export.
- Sales: multi-item transaction, product picker (auto-fill harga = modal/qty), grand total, auto stock decrement, delete, Excel export.
- Verified: testing agent 100% (13/13 backend, all frontend flows).

## Backlog (P1/P2)
- P1: Kembalikan stock otomatis saat transaksi penjualan dihapus.
- P1: Harga jual terpisah dari harga modal + laporan laba/rugi.
- P2: PDF export / cetak struk.
- P2: Filter penjualan berdasarkan rentang tanggal.

## Next Tasks
- Await user feedback.
