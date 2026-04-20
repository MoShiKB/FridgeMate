package com.project.fridgemate.ui.fridge

import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.recyclerview.widget.RecyclerView
import com.project.fridgemate.R
import com.project.fridgemate.databinding.ItemCategoryHeaderBinding
import com.project.fridgemate.databinding.ItemProductBinding
import com.project.fridgemate.databinding.ItemRunningLowBinding

class FridgeAdapter(private val items: List<FridgeItem>) :
    RecyclerView.Adapter<RecyclerView.ViewHolder>() {

    companion object {
        private const val TYPE_RUNNING_LOW = 0
        private const val TYPE_CATEGORY_HEADER = 1
        private const val TYPE_PRODUCT = 2
    }

    override fun getItemViewType(position: Int): Int {
        return when (items[position]) {
            is FridgeItem.RunningLow -> TYPE_RUNNING_LOW
            is FridgeItem.CategoryHeader -> TYPE_CATEGORY_HEADER
            is FridgeItem.Product -> TYPE_PRODUCT
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): RecyclerView.ViewHolder {
        val inflater = LayoutInflater.from(parent.context)
        return when (viewType) {
            TYPE_RUNNING_LOW -> {
                val binding = ItemRunningLowBinding.inflate(inflater, parent, false)
                RunningLowViewHolder(binding)
            }
            TYPE_CATEGORY_HEADER -> {
                val binding = ItemCategoryHeaderBinding.inflate(inflater, parent, false)
                CategoryHeaderViewHolder(binding)
            }
            TYPE_PRODUCT -> {
                val binding = ItemProductBinding.inflate(inflater, parent, false)
                ProductViewHolder(binding)
            }
            else -> throw IllegalArgumentException("Invalid view type")
        }
    }

    override fun onBindViewHolder(holder: RecyclerView.ViewHolder, position: Int) {
        when (val item = items[position]) {
            is FridgeItem.RunningLow -> (holder as RunningLowViewHolder).bind(item)
            is FridgeItem.CategoryHeader -> (holder as CategoryHeaderViewHolder).bind(item)
            is FridgeItem.Product -> {
                val isLastInSection = position == items.size - 1 || items[position + 1] is FridgeItem.CategoryHeader
                (holder as ProductViewHolder).bind(item, isLastInSection)
            }
        }
    }

    override fun getItemCount(): Int = items.size

    class RunningLowViewHolder(private val binding: ItemRunningLowBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(item: FridgeItem.RunningLow) {
            val listString = item.ingredients.joinToString(", ")
            binding.tvLowStockList.text = binding.root.context.getString(R.string.low_stock_restock_format, listString)
        }
    }

    class CategoryHeaderViewHolder(private val binding: ItemCategoryHeaderBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(item: FridgeItem.CategoryHeader) {
            binding.tvCategoryName.text = item.name
        }
    }

    class ProductViewHolder(private val binding: ItemProductBinding) :
        RecyclerView.ViewHolder(binding.root) {
        fun bind(item: FridgeItem.Product, isLastInSection: Boolean) {
            binding.tvProductName.text = item.name
            binding.tvProductQuantity.text = item.quantity
            binding.ivLowStockWarning.visibility = if (item.isLowStock) View.VISIBLE else View.GONE
            binding.divider.visibility = if (isLastInSection) View.GONE else View.VISIBLE
        }
    }
}
