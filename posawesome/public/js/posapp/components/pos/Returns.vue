<!-- @ngrie -->
<template>
	<!-- =========================================== -->
	<!-- RETURNS DIALOG -->
	<!-- =========================================== -->
	<div style="display: flex; justify-content: center; align-items: center">
		<!-- Modal Overlay -->
		<div
			v-if="invoicesDialog"
			@click="invoicesDialog = false"
			style="
				position: fixed;
				top: 0;
				left: 0;
				right: 0;
				bottom: 0;
				background: rgba(0, 0, 0, 0.5);
				display: flex;
				align-items: center;
				justify-content: center;
				z-index: 1000;
			"
		>
			<!-- Modal -->
			<div
				@click.stop
				style="
					background: white;
					border-radius: 8px;
					box-shadow: 0 10px 30px rgba(0, 0, 0, 0.3);
					max-width: 90vw;
					min-width: 600px;
					width: auto;
					max-height: 90vh;
					overflow: hidden;
				"
			>
				<!-- Card -->
				<div
					style="
						background: white;
						border-radius: 12px;
						overflow: hidden;
						box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
					"
				>
					<!-- =========================================== -->
					<!-- CARD HEADER -->
					<!-- =========================================== -->
					<div
						style="
							background: #607d8b;
							color: white;
							padding: 12px 16px;
							border-bottom: 1px solid #e0e0e0;
							position: relative;
						"
					>
						<span
							style="
								color: white;
								display: flex;
								align-items: center;
								gap: 8px;
								font-size: 1.25rem;
								font-weight: 700;
								color: white;
							"
						>
							<i class="mdi mdi-keyboard-return" style="font-size: 18px"></i>
							<!-- Return Invoice -->
							جدول إرجاع فاتورة
						</span>
						<button
							@click="invoicesDialog = false"
							style="
								position: absolute;
								top: 8px;
								right: 8px;
								background: none;
								border: none;
								font-size: 1.5rem;
								color: white;
								cursor: pointer;
								width: 32px;
								height: 32px;
								display: flex;
								align-items: center;
								justify-content: center;
								border-radius: 50%;
							"
						>
							×
						</button>
					</div>

					<!-- =========================================== -->
					<!-- CARD BODY -->
					<!-- =========================================== -->
					<div
						style="
							max-height: 60vh;
							overflow-y: auto;
							display: flex;
							flex-direction: column;
							padding: 16px;
						"
					>
						<!-- Search Row -->
						<div style="display: flex; gap: 8px; margin-bottom: 12px">
							<!-- Invoice Number Input -->
							<div
								style="
									display: flex;
									flex-direction: column;
									gap: 4px;
									width: 100%;
									flex: 1;
								"
							>
								<label
									style="
										font-size: 0.75rem;
										font-weight: 600;
										color: #555;
										margin-bottom: 2px;
									"
								>
									<!-- Invoice Number -->
									رقم الفاتورة
								</label>
								<input
									type="text"
									v-model="invoice_name"
									placeholder="رقم الفاتورة"
									@keydown.enter="search_invoices"
									style="
										width: 100%;
										padding: 8px 12px;
										font-size: 0.85rem;
										color: #333;
										background: white;
										border: 1px solid #d0d0d0;
										border-radius: 6px;
										outline: none;
									"
								/>
							</div>

							<!-- Search Button -->
							<button
								@click="search_invoices"
								style="
									display: inline-flex;
									align-items: center;
									justify-content: center;
									padding: 8px 16px;
									height: 40px;
									font-size: 12px;
									font-weight: 500;
									cursor: pointer;
									border: 1px solid #1565c0;
									line-height: 1.5;
									box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
									background: linear-gradient(135deg, #1976d2 0%, #1e88e5 100%);
									color: white;
									border-radius: 6px;
									margin-top: 20px;
								"
							>
								<!-- Search -->
								بحث
							</button>
						</div>

						<!-- Table Container -->
						<div style="flex: 1; min-height: 0">
							<div style="max-height: 60vh; overflow-y: auto">
								<!-- Loading State -->
								<div
									v-if="isLoading"
									style="
										display: flex;
										flex-direction: column;
										align-items: center;
										justify-content: center;
										padding: 40px;
										gap: 12px;
									"
								>
									<div
										style="
											width: 40px;
											height: 40px;
											border: 4px solid #f3f3f3;
											border-top: 4px solid #1976d2;
											border-radius: 50%;
										"
									></div>
									<span style="font-size: 14px; color: #666">
										<!-- Loading invoices... -->
										جاري تحميل الفواتير...
									</span>
								</div>

								<!-- No Data -->
								<div
									v-else-if="dialog_data.length === 0"
									style="
										display: flex;
										flex-direction: column;
										align-items: center;
										justify-content: center;
										padding: 40px;
										color: #999;
										font-size: 14px;
									"
								>
									<!-- No invoices found -->
									لم يتم العثور على فواتير
								</div>

								<!-- Table -->
								<table
									v-else
									style="
										width: 100%;
										border-collapse: collapse;
										font-size: 0.875rem;
										background: white;
										table-layout: auto;
									"
								>
									<!-- Table Headers -->
									<thead>
										<tr
											style="
												border-bottom: 2px solid #e0e0e0;
												background: #607d8b;
												color: white;
											"
										>
											<th
												v-for="header in headers"
												:key="header.key"
												:style="{
													padding: '10px',
													textAlign: header.align || 'left',
													fontWeight: '600',
													color: 'white',
													fontSize: '0.75rem',
													textTransform: 'uppercase',
													whiteSpace: 'nowrap',
												}"
											>
												{{ header.title }}
											</th>
										</tr>
									</thead>

									<!-- Table Body -->
									<tbody>
										<tr
											v-for="item in dialog_data"
											:key="item.name"
											@click="selectInvoice(item)"
											:style="
												selected && selected.name === item.name
													? 'background: #e3f2fd; cursor: pointer;'
													: 'cursor: pointer;'
											"
											style="border-bottom: 1px solid #e0e0e0"
										>
											<!-- Customer -->
											<td
												style="
													padding: 10px;
													text-align: left;
													white-space: nowrap;
												"
											>
												{{ item.customer }}
											</td>

											<!-- Posting Date -->
											<td
												style="
													padding: 10px;
													text-align: left;
													white-space: nowrap;
												"
											>
												{{ item.posting_date }}
											</td>

											<!-- Posting Time -->
											<td
												style="
													padding: 10px;
													text-align: center;
													white-space: nowrap;
												"
											>
												{{
													item.posting_time
														? item.posting_time.split('.')[0]
														: '-'
												}}
											</td>

											<!-- Invoice Name -->
											<td
												style="
													padding: 10px;
													text-align: left;
													white-space: nowrap;
												"
											>
												<a
													:href="getInvoiceUrl(item.name)"
													target="_blank"
													@click.stop
													style="
														color: #3b82f6;
														font-weight: 600;
														font-size: 12px;
														font-family: 'Courier New', monospace;
														text-decoration: none;
													"
												>
													{{ item.name }}
													<i
														class="mdi mdi-open-in-new"
														style="font-size: 10px; margin-left: 4px"
													></i>
												</a>
											</td>

											<!-- Invoice Status -->
											<td
												style="
													padding: 10px;
													text-align: center;
													white-space: nowrap;
												"
											>
												<span
													:style="{
														display: 'inline-block',
														padding: '4px 12px',
														borderRadius: '12px',
														fontSize: '0.75rem',
														fontWeight: '600',
														whiteSpace: 'nowrap',
														backgroundColor:
															(item.invoice_status ||
																item.status) === 'Paid'
																? '#e8f5e9'
																: (item.invoice_status ||
																		item.status) === 'Unpaid'
																? '#ffebee'
																: (item.invoice_status ||
																		item.status) ===
																  'Partly Paid'
																? '#fff3e0'
																: (item.invoice_status ||
																		item.status) === 'Return'
																? '#f3e5f5'
																: (item.invoice_status ||
																		item.status) ===
																  'Credit Note Issued'
																? '#e1bee7'
																: '#f5f5f5',
														color:
															(item.invoice_status ||
																item.status) === 'Paid'
																? '#2e7d32'
																: (item.invoice_status ||
																		item.status) === 'Unpaid'
																? '#c62828'
																: (item.invoice_status ||
																		item.status) ===
																  'Partly Paid'
																? '#e65100'
																: (item.invoice_status ||
																		item.status) === 'Return'
																? '#6a1b9a'
																: (item.invoice_status ||
																		item.status) ===
																  'Credit Note Issued'
																? '#7b1fa2'
																: '#616161',
														border:
															(item.invoice_status ||
																item.status) === 'Paid'
																? '1px solid #4caf50'
																: (item.invoice_status ||
																		item.status) === 'Unpaid'
																? '1px solid #ef5350'
																: (item.invoice_status ||
																		item.status) ===
																  'Partly Paid'
																? '1px solid #ff9800'
																: (item.invoice_status ||
																		item.status) === 'Return'
																? '1px solid #9c27b0'
																: (item.invoice_status ||
																		item.status) ===
																  'Credit Note Issued'
																? '1px solid #ab47bc'
																: '1px solid #9e9e9e',
													}"
												>
													{{ item.invoice_status || item.status || '-' }}
												</span>
											</td>

											<!-- Grand Total -->
											<td
												style="
													padding: 10px;
													text-align: right;
													font-weight: 600;
													color: #1976d2;
													white-space: nowrap;
												"
											>
												{{ currencySymbol(item.currency) }}
												{{ formatCurrency(item.grand_total) }}
											</td>
										</tr>
									</tbody>
								</table>
							</div>
						</div>
					</div>

					<!-- =========================================== -->
					<!-- CARD FOOTER -->
					<!-- =========================================== -->
					<div
						style="
							display: flex;
							align-items: center;
							justify-content: flex-end;
							gap: 8px;
							padding: 12px 16px;
							border-top: 1px solid #e0e0e0;
							flex-shrink: 0;
							margin-top: auto;
						"
					>
						<div style="flex: 1"></div>

						<!-- Close Button -->
						<button
							@click="close_dialog"
							style="
								display: inline-flex;
								align-items: center;
								justify-content: center;
								padding: 6px 16px;
								border-radius: 6px;
								font-size: 12px;
								font-weight: 500;
								cursor: pointer;
								border: 1px solid #d32f2f;
								line-height: 1.5;
								box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
								background: white;
								color: #d32f2f;
							"
						>
							<!-- Close -->
							إغلاق
						</button>

						<!-- Select Button -->
						<button
							@click="submit_dialog"
							style="
								display: inline-flex;
								align-items: center;
								justify-content: center;
								padding: 6px 16px;
								border-radius: 6px;
								font-size: 12px;
								font-weight: 500;
								cursor: pointer;
								border: 1px solid #2e7d32;
								line-height: 1.5;
								box-shadow: 0 2px 4px rgba(0, 0, 0, 0.1);
								background: linear-gradient(135deg, #4caf50 0%, #388e3c 100%);
								color: white;
							"
						>
							<!-- Select -->
							اختر
						</button>
					</div>
				</div>
			</div>
		</div>
	</div>
</template>

<script src="./Returns.js" />
