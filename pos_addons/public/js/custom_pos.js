erpnext.pos.PointOfSale.prototype.make_items =  function() {
    this.items = new PItm({
        wrapper: this.wrapper.find('.item-container'),
        frm: this.frm,
        events: {
            update_cart: (item, field, value) => {
                if(!this.frm.doc.customer) {
                    frappe.throw(__('Please select a customer'));
                }
                this.update_item_in_cart(item, field, value);
                this.cart && this.cart.unselect_all();
            }
        }
    });
}
class PItm extends POSItems {
	make_dom() {
		this.wrapper.html(`
			<div class="fields">
				<div class="search-field">
				</div>
				<div class="item-group-field">
				</div>
			</div>
			<div class="vehicle-filter-fields" style="display: flex;">
				<div class="vehicle-make" style="margin-right: 10px"></div>
				<div class="vehicle-model" style="margin-right: 10px"></div>
				<div class="vehicle-year" style="margin-right: 10px"></div>
				<div class="vehicle-engine"></div>
			</div>
			<div class="items-wrapper">
			</div>
		`);

		this.items_wrapper = this.wrapper.find('.items-wrapper');
		this.items_wrapper.append(`
			<div class="list-item-table pos-items-wrapper">
				<div class="pos-items image-view-container">
				</div>
			</div>
		`);
	}

    make_fields() {
		// Search field
		const me = this;
		// const vm_ref = document.querySelector("input[data-fieldname=vehicles_model]");
		// vm_ref.disabled = true;
		this.search_field = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Data',
				fieldname: 'search_field',
				label: __('Search Item (Ctrl + i)'),
				placeholder: __('Search by item code, serial number, batch no or barcode')
			},
			parent: this.wrapper.find('.search-field'),
			render_input: true,
		});

		frappe.ui.keys.on('ctrl+i', () => {
			this.search_field.set_focus();
		});

		this.search_field.$input.on('input', (e) => {
			clearTimeout(this.last_search);
			this.last_search = setTimeout(() => {
				const search_term = e.target.value;
				this.g_search_term = e.target.value;
				const item_group = this.item_group_field ?
					this.item_group_field.get_value() : '';

				this.filter_items({ search_term:search_term,  item_group: item_group});
			}, 300);
		});

		this.item_group_field = frappe.ui.form.make_control({
			df: {
				fieldtype: 'Link',
				label: 'Item Group',
				options: 'Item Group',
				default: me.parent_item_group,
				onchange: () => {
					const item_group = this.item_group_field.get_value();
					if (item_group) {
						this.filter_items({ search_term: this.g_search_term, item_group: item_group });
					}
				},
				get_query: () => {
					return {
						query: 'erpnext.selling.page.point_of_sale.point_of_sale.item_group_query',
						filters: {
							pos_profile: this.frm.doc.pos_profile
						}
					};
				}
			},
			parent: this.wrapper.find('.item-group-field'),
			render_input: true
		});
		// Vehicle Make
		this.vehicle_make = frappe.ui.form.make_control({
			df: {
				label: frappe._('Vehicle Make'),
                fieldname: 'vehicle_manufacturers',
				fieldtype: 'Link',
				options: 'Vehicle Manufacturers',
				onchange: () => {
					this.filter_items();
					
					// this.vehicle_make.get_value() ? vm_ref.disabled = false : vm_ref.disabled = true; 
					// const item_group = this.item_group_field.get_value();
					// if (item_group) {
					// 	this.filter_items({ item_group: item_group });
					// }
					// var sf = document.querySelector("input[data-fieldname=search_field]");
					// sf.value = sf.value;
				},
			},
			parent: this.wrapper.find('.vehicle-make'),
			render_input: true
		});
		// Vehicle Model
		this.vehicles_model = frappe.ui.form.make_control({
			df: {
				label: frappe._('Vehicle Model'),
                fieldname: 'vehicles_model',
				fieldtype: 'Link',
				options: 'Vehicles Model',
				onchange: () => {
					this.filter_items();
				},
				get_query: () => {
					return {
						filters: [
							['vehicle_manufacturers', '=', this.vehicle_make.get_value()]
						]
					}
				}

			},
			parent: this.wrapper.find('.vehicle-model'),
			render_input: true
		});
		// Model Year
		this.model_year = frappe.ui.form.make_control({
			df: {
				label: frappe._('Model Year'),
				fieldname: 'year_model_v',
				fieldtype: 'Data',
				onchange: () => {
					this.filter_items();
				},
			},
			parent: this.wrapper.find('.vehicle-year'),
			render_input: true
		});
		// Model Year
		this.engine = frappe.ui.form.make_control({
			df: {
				label: frappe._('Engine'),
				fieldname: 'vehicle_engine',
				fieldtype: 'Data',
				onchange: () => {
					this.filter_items();
				},
			},
			parent: this.wrapper.find('.vehicle-engine'),
			render_input: true
		});
	}
	


    filter_items({ search_term='', item_group=this.parent_item_group }={}) {
		console.log(`search_term=${search_term}, item_group=${item_group}`);
		if (search_term) {
			console.log("except all groups");
			search_term = search_term.toLowerCase();
			// memoize
			this.search_index = this.search_index || {};
			if (this.search_index[search_term]) {
				const items = this.search_index[search_term];
				this.items = items;
				this.render_items(items);
				this.set_item_in_the_cart(items);
				return;
			}
		} 
		// else if (item_group == this.parent_item_group) {
		// 	console.log('item_group == this.parent_item_group', item_group, this.parent_item_group);
		// 	this.items = this.all_items;
		// 	// return this.render_items(this.all_items);
		// }
		this.get_items({search_value: search_term, item_group })
		.then(({ items, serial_no, batch_no, barcode }) => {
			if (search_term && !barcode) {
				this.search_index[search_term] = items;
			}
			console.log('then block');
			this.items = items;
			this.render_items(items);
			this.set_item_in_the_cart(items, serial_no, batch_no, barcode);
		});
	}
	
	get_items({start = 0, page_length = 40, search_value='', item_group=this.parent_item_group}={}) {
		if (!this.frm.doc.pos_profile)
		return;
		const price_list = this.frm.doc.selling_price_list;
		return new Promise(res => {
			frappe.call({
				method: "erpnext.selling.page.point_of_sale.point_of_sale.get_items",
				freeze: true,
				args: {
					start,
					page_length,
					price_list,
					item_group,
					vehicle_make: this.vehicle_make.get_value(),
					vehicles_model: this.vehicles_model.get_value(),
					model_year: this.model_year.get_value(),
					engine: this.engine.get_value(),
					search_value,
					pos_profile: this.frm.doc.pos_profile
				}
			}).then(r => {
				// const { items, serial_no, batch_no } = r.message;

				// this.serial_no = serial_no || "";
				res(r.message);
			});
		});
	}
}








