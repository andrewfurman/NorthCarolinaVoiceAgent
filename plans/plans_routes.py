
from flask import Blueprint, render_template, request, jsonify
from contextlib import contextmanager
from sqlalchemy.orm import Session

# Create Blueprint
plans_bp = Blueprint('plans', __name__, 
                    template_folder='templates',
                    static_folder='static',
                    url_prefix='/plans')

@contextmanager
def session_scope():
    """Provide a transactional scope around a series of operations."""
    from main import Session
    session = Session()
    try:
        yield session
        session.commit()
    except Exception as e:
        session.rollback()
        print(f"Database error: {str(e)}")
        raise
    finally:
        session.close()

@plans_bp.route('/')
def show_plans():
    """Route to display the plans page"""
    from plans.plans_model import Plan
    with session_scope() as session:
        plans = session.query(Plan).all()
        return render_template('plans.html', plans=plans)

@plans_bp.route('/<plan_id>')
def view_plan(plan_id):
    """Route to display a single plan's details"""
    from plans.plans_model import Plan
    with session_scope() as session:
        plan = session.query(Plan).filter(Plan.id == plan_id).first()
        return render_template('view_plan.html', plan=plan)

@plans_bp.route('/<plan_id>/update', methods=['POST'])
def update_plan(plan_id):
    """Route to update a plan's details"""
    from plans.plans_model import Plan
    with session_scope() as session:
        try:
            plan = session.query(Plan).filter(Plan.id == plan_id).first()
            if not plan:
                return jsonify({'error': 'Plan not found'}), 404

            data = request.json
            plan.short_name = data.get('short_name', plan.short_name)
            plan.full_name = data.get('full_name', plan.full_name)
            plan.summary_of_benefits = data.get('summary_of_benefits', plan.summary_of_benefits)
            plan.summary_of_benefits_url = data.get('summary_of_benefits_url', plan.summary_of_benefits_url)
            plan.compressed_summary = data.get('compressed_summary', plan.compressed_summary)

            return jsonify({'message': 'Plan updated successfully'}), 200
        except Exception as e:
            return jsonify({'error': str(e)}), 500
